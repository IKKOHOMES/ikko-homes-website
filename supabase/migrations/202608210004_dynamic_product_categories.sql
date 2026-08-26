create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  parent_id uuid references public.product_categories(id) on delete restrict,
  depth smallint not null check (depth between 1 and 3),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_categories_unique_sibling_name
  on public.product_categories ((coalesce(parent_id::text, 'root')), lower(name));

create or replace function public.validate_product_category_hierarchy()
returns trigger language plpgsql as $$
declare
  parent_depth smallint;
begin
  if new.depth = 1 then
    if new.parent_id is not null then
      raise exception 'Level-one categories cannot have a parent.';
    end if;
    return new;
  end if;

  if new.parent_id is null then
    raise exception 'Nested categories require a parent.';
  end if;

  select depth into parent_depth from public.product_categories where id = new.parent_id;
  if parent_depth is null or parent_depth <> new.depth - 1 then
    raise exception 'A category parent must be exactly one level above its child.';
  end if;
  return new;
end;
$$;

create trigger validate_product_category_hierarchy
before insert or update of parent_id, depth on public.product_categories
for each row execute procedure public.validate_product_category_hierarchy();

create trigger touch_product_categories
before update on public.product_categories
for each row execute procedure public.touch_updated_at();

alter table public.products
  add column category_id uuid references public.product_categories(id) on delete restrict;

create or replace function public.validate_product_leaf_category()
returns trigger language plpgsql as $$
declare
  category_depth smallint;
begin
  if new.category_id is null then
    return new;
  end if;
  select depth into category_depth from public.product_categories where id = new.category_id;
  if category_depth <> 3 then
    raise exception 'Products can only be assigned to a level-three category.';
  end if;
  return new;
end;
$$;

create trigger validate_product_leaf_category
before insert or update of category_id on public.products
for each row execute procedure public.validate_product_leaf_category();

alter table public.product_categories enable row level security;

create policy "admins manage product categories" on public.product_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "public reads active product categories" on public.product_categories for select to anon, authenticated
using (is_active);

insert into public.product_categories (name, slug, parent_id, depth, display_order)
values
  ('Furniture', 'furniture', null, 1, 1),
  ('Fixture', 'fixture', null, 1, 2)
on conflict (slug) do update set name = excluded.name, display_order = excluded.display_order, is_active = true;

insert into public.product_categories (name, slug, parent_id, depth, display_order)
select child.name, child.slug, parent.id, 2, child.display_order
from (values
  ('Living', 'living', 'furniture', 1),
  ('Dining', 'dining', 'furniture', 2),
  ('Bedroom', 'bedroom', 'furniture', 3),
  ('Lighting', 'lighting', 'fixture', 1)
) as child(name, slug, parent_slug, display_order)
join public.product_categories parent on parent.slug = child.parent_slug
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id, display_order = excluded.display_order, is_active = true;

insert into public.product_categories (name, slug, parent_id, depth, display_order)
select child.name, child.slug, parent.id, 3, child.display_order
from (values
  ('Sofa', 'sofa', 'living', 1),
  ('Coffee table', 'coffee-table', 'living', 2),
  ('Side table', 'side-table', 'living', 3),
  ('Dining table', 'dining-table', 'dining', 1),
  ('Dining chair', 'dining-chair', 'dining', 2),
  ('Beds', 'beds', 'bedroom', 1),
  ('Bedside table', 'bedside-table', 'bedroom', 2),
  ('Pendant', 'pendant', 'lighting', 1),
  ('Lamps', 'lamps', 'lighting', 2),
  ('Wall lights', 'wall-lights', 'lighting', 3)
) as child(name, slug, parent_slug, display_order)
join public.product_categories parent on parent.slug = child.parent_slug
on conflict (slug) do update set name = excluded.name, parent_id = excluded.parent_id, display_order = excluded.display_order, is_active = true;

update public.products as product
set category_id = category.id
from public.product_categories as category
where category.slug = case product.slug
  when 'mori-lounge-chair' then 'sofa'
  when 'haru-3-seater-sofa' then 'sofa'
  when 'kumo-modular-sofa' then 'sofa'
  when 'aoi-curved-sofa' then 'sofa'
  when 'sumi-2-seater-sofa' then 'sofa'
  when 'nori-low-sofa' then 'sofa'
  when 'kiri-daybed' then 'sofa'
  when 'ryo-round-coffee-table' then 'coffee-table'
  when 'nami-pendant-light' then 'pendant'
  when 'kumo-floor-lamp' then 'lamps'
  when 'ren-table-lamp' then 'lamps'
  when 'aki-wall-sconce' then 'wall-lights'
  else null
end;
