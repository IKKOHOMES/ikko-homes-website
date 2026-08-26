create table public.home_page_content (
  id boolean primary key default true check (id),
  hero_eyebrow text not null default '',
  hero_heading text not null default '',
  hero_cta_label text not null default '',
  hero_cta_path text not null default '/contact' check (hero_cta_path ~ '^/'),
  hero_image_path text,
  updated_at timestamptz not null default now()
);

create table public.home_service_pillars (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  icon_key text not null default 'sparkles' check (icon_key in ('consultation', 'joinery', 'furniture', 'delivery')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.style_ranges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  eyebrow text not null default '',
  headline text not null default '',
  description text not null default '',
  hero_image_path text,
  room_image_path text,
  palette jsonb not null default '[]'::jsonb check (jsonb_typeof(palette) = 'array'),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_home_page_content before update on public.home_page_content for each row execute procedure public.touch_updated_at();
create trigger touch_home_service_pillars before update on public.home_service_pillars for each row execute procedure public.touch_updated_at();
create trigger touch_style_ranges before update on public.style_ranges for each row execute procedure public.touch_updated_at();

alter table public.home_page_content enable row level security;
alter table public.home_service_pillars enable row level security;
alter table public.style_ranges enable row level security;

create policy "public reads homepage content" on public.home_page_content for select to anon, authenticated using (true);
create policy "admins manage homepage content" on public.home_page_content for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads active homepage pillars" on public.home_service_pillars for select to anon, authenticated using (is_active);
create policy "admins manage homepage pillars" on public.home_service_pillars for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads active style ranges" on public.style_ranges for select to anon, authenticated using (is_active);
create policy "admins manage style ranges" on public.style_ranges for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values
  ('site-assets', 'site-assets', true),
  ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public reads site assets') then
    create policy "public reads site assets" on storage.objects for select to anon, authenticated using (bucket_id = 'site-assets');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'admins manage site assets') then
    create policy "admins manage site assets" on storage.objects for all to authenticated using (bucket_id = 'site-assets' and public.is_admin()) with check (bucket_id = 'site-assets' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public reads product assets') then
    create policy "public reads product assets" on storage.objects for select to anon, authenticated using (bucket_id = 'product-assets');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'admins manage product assets') then
    create policy "admins manage product assets" on storage.objects for all to authenticated using (bucket_id = 'product-assets' and public.is_admin()) with check (bucket_id = 'product-assets' and public.is_admin());
  end if;
end;
$$;

insert into public.home_page_content (id, hero_eyebrow, hero_heading, hero_cta_label, hero_cta_path)
values (true, '', 'Timeless Design. Made for Living.', 'Book a consultation', '/contact')
on conflict (id) do nothing;

insert into public.home_service_pillars (title, description, icon_key, display_order)
values
  ('Design Consultation', 'Tailored guidance to shape a space that reflects your lifestyle.', 'consultation', 1),
  ('Custom Joinery', 'Bespoke joinery crafted in-house for a perfect fit and lasting quality.', 'joinery', 2),
  ('Furniture & Styling', 'Curated furniture and styling to complete your space beautifully.', 'furniture', 3),
  ('Project Delivery', 'End-to-end project management with care and transparency.', 'delivery', 4)
on conflict do nothing;

insert into public.style_ranges (slug, name, eyebrow, headline, description, palette, display_order)
values
  ('japanese-modern', 'Japanese Modern', 'Japanese Modern', 'Quietly considered living.', 'Clean lines, natural materials and thoughtful details create calm, balanced spaces for everyday life.', '["#d9d6d0", "#b78b5d", "#e5d4be", "#c9c7c3", "#dfd9d1"]'::jsonb, 1),
  ('japandi', 'Japandi', 'Japandi', 'Warmth in every detail.', 'Scandinavian simplicity meets Japanese craftsmanship to create spaces that feel warm, calm and timeless.', '["#e1ddd4", "#bd8753", "#e8ded1", "#d7d4cf", "#d6cec1"]'::jsonb, 2),
  ('organic-modern', 'Organic Modern', 'Organic Modern', 'Soft forms. Natural ease.', 'Sculptural silhouettes, tactile materials and organic textures come together to create spaces that feel grounded and inviting.', '["#cdbda8", "#b58c6a", "#e9e0d6", "#c7c3b9", "#ded4c9"]'::jsonb, 3)
on conflict (slug) do nothing;
