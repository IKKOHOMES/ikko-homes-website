create table public.cabinetry_products (
  id uuid primary key default gen_random_uuid(),
  style_range_id uuid not null unique references public.style_ranges(id) on delete cascade,
  eyebrow text not null default 'Bespoke cabinetry' check (length(trim(eyebrow)) > 0),
  headline text not null check (length(trim(headline)) > 0),
  description text not null check (length(trim(description)) > 0),
  scope text not null check (length(trim(scope)) > 0),
  hero_image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cabinetry_product_images (
  id uuid primary key default gen_random_uuid(),
  cabinetry_product_id uuid not null references public.cabinetry_products(id) on delete cascade,
  image_path text not null check (length(trim(image_path)) > 0),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cabinetry_product_images_product_order_idx
  on public.cabinetry_product_images (cabinetry_product_id, display_order);

create trigger touch_cabinetry_products_updated_at
  before update on public.cabinetry_products
  for each row execute procedure public.touch_updated_at();

create trigger touch_cabinetry_product_images_updated_at
  before update on public.cabinetry_product_images
  for each row execute procedure public.touch_updated_at();

alter table public.cabinetry_products enable row level security;
alter table public.cabinetry_product_images enable row level security;

create policy "public reads active cabinetry products"
  on public.cabinetry_products for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.style_ranges
      where style_ranges.id = cabinetry_products.style_range_id
        and style_ranges.is_active
    )
  );

create policy "admins manage cabinetry products"
  on public.cabinetry_products for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "public reads active cabinetry product images"
  on public.cabinetry_product_images for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.cabinetry_products
      join public.style_ranges on style_ranges.id = cabinetry_products.style_range_id
      where cabinetry_products.id = cabinetry_product_images.cabinetry_product_id
        and cabinetry_products.is_active
        and style_ranges.is_active
    )
  );

create policy "admins manage cabinetry product images"
  on public.cabinetry_product_images for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.cabinetry_products to anon;
grant select, insert, update, delete on public.cabinetry_products to authenticated;
grant select on public.cabinetry_product_images to anon;
grant select, insert, update, delete on public.cabinetry_product_images to authenticated;

insert into public.cabinetry_products (style_range_id, headline, description, scope, hero_image_path)
select
  style_ranges.id,
  style_ranges.name || ' Cabinetry',
  'Made-to-measure cabinetry for kitchens, wardrobes, laundries and living spaces.',
  'Kitchen · Wardrobe · Laundry · Living',
  style_ranges.room_image_path
from public.style_ranges
on conflict (style_range_id) do nothing;
