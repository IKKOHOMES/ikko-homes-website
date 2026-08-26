create table public.home_theme_blocks (
  id uuid primary key default gen_random_uuid(),
  style_range_id uuid not null unique references public.style_ranges(id) on delete cascade,
  eyebrow text not null default '',
  headline text not null default '',
  description text not null default '',
  image_path text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_home_theme_blocks before update on public.home_theme_blocks for each row execute procedure public.touch_updated_at();

alter table public.home_theme_blocks enable row level security;

create policy "public reads visible homepage theme blocks" on public.home_theme_blocks for select to anon, authenticated using (is_active);
create policy "admins manage homepage theme blocks" on public.home_theme_blocks for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.home_theme_blocks to anon;
grant select, insert, update, delete on public.home_theme_blocks to authenticated;

insert into public.home_theme_blocks (style_range_id, eyebrow, headline, description, image_path, display_order, is_active)
select id, eyebrow, headline, description, room_image_path, display_order, is_active
from public.style_ranges
where slug in ('japanese-modern', 'japandi', 'organic-modern')
on conflict (style_range_id) do nothing;
