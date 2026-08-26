create table public.style_range_palette_items (
  id uuid primary key default gen_random_uuid(),
  style_range_id uuid not null references public.style_ranges(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  colour text not null check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  image_path text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index style_range_palette_items_range_order_idx
  on public.style_range_palette_items (style_range_id, display_order);

create trigger touch_style_range_palette_items_updated_at
  before update on public.style_range_palette_items
  for each row execute procedure public.touch_updated_at();

alter table public.style_range_palette_items enable row level security;

create policy "public reads active style range palette items"
  on public.style_range_palette_items for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.style_ranges
      where style_ranges.id = style_range_palette_items.style_range_id
        and style_ranges.is_active
    )
  );

create policy "admins manage style range palette items"
  on public.style_range_palette_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.style_range_palette_items to anon;
grant select, insert, update, delete on public.style_range_palette_items to authenticated;

with source_items as (
  select
    style_ranges.id as style_range_id,
    palette_entry.colour,
    palette_entry.ordinality::integer as display_order,
    case palette_entry.ordinality
      when 1 then 'Benchtop'
      when 2 then 'Cabinetry'
      when 3 then 'Floorboard'
      when 4 then 'Tiles'
      when 5 then 'Paint'
      else 'Material ' || palette_entry.ordinality::text
    end as name
  from public.style_ranges
  cross join lateral jsonb_array_elements_text(style_ranges.palette) with ordinality as palette_entry(colour, ordinality)
)
insert into public.style_range_palette_items (style_range_id, name, colour, display_order)
select source_items.style_range_id, source_items.name, source_items.colour, source_items.display_order
from source_items
where not exists (
  select 1 from public.style_range_palette_items existing
  where existing.style_range_id = source_items.style_range_id
    and existing.display_order = source_items.display_order
);
