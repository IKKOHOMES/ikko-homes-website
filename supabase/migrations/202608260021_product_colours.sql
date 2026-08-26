create table public.product_colours (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  hex_code text not null check (hex_code ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_colours_name_ci_key on public.product_colours (lower(name));

alter table public.product_finishes
  add column colour_id uuid references public.product_colours(id) on delete restrict;

create index product_finishes_colour_id_idx on public.product_finishes (colour_id);

alter table public.product_colours enable row level security;

create policy "admins manage product colours"
  on public.product_colours for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "public reads product colours"
  on public.product_colours for select to anon, authenticated
  using (true);

grant select, insert, update, delete on public.product_colours to authenticated;
grant select on public.product_colours to anon;
