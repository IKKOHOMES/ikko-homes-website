create extension if not exists pgcrypto;

create type public.order_status as enum ('new', 'reviewing', 'quoted', 'invoiced', 'completed');
create type public.invoice_status as enum ('issued', 'void');
create type public.blog_status as enum ('draft', 'published', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  price numeric(12,2) not null check (price >= 0),
  category text not null,
  subcategory text not null default '',
  theme_slugs text[] not null default '{}',
  image_tone text not null default 'chair',
  image_path text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_finishes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  unique (product_id, name)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,
  alt_text text not null default '',
  display_order integer not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers(id),
  status public.order_status not null default 'new',
  internal_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_kind text not null check (line_kind in ('furniture', 'cabinetry')),
  product_id uuid references public.products(id),
  display_name text not null,
  unit_price numeric(12,2),
  quantity integer not null check (quantity > 0),
  finish text,
  created_at timestamptz not null default now(),
  check ((line_kind = 'furniture' and unit_price is not null) or (line_kind = 'cabinetry' and unit_price is null))
);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.cabinetry_drawings (
  id uuid primary key default gen_random_uuid(),
  order_line_id uuid not null unique references public.order_lines(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  content_type text not null,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  version integer not null,
  total numeric(12,2) not null check (total >= 0),
  expires_on date not null,
  internal_note text not null default '',
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  display_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0)
);

create table public.invoice_sequences (
  id boolean primary key default true check (id),
  prefix text not null default 'IKKO-',
  next_number bigint not null default 1001 check (next_number > 0)
);
insert into public.invoice_sequences (id) values (true);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null references public.orders(id),
  customer_name text not null,
  customer_email text not null,
  customer_address text not null,
  total numeric(12,2) not null check (total >= 0),
  status public.invoice_status not null default 'issued',
  created_at timestamptz not null default now()
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  display_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  finish text
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  location text not null,
  introduction text not null,
  style text not null default '',
  cover_image_path text,
  image_tone text not null default 'bondi',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  alt_text text not null default '',
  display_order integer not null default 0
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  body text not null,
  cover_image_path text,
  publication_date timestamptz not null,
  status public.blog_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blog_social_links (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'xiaohongshu')),
  url text not null,
  unique (post_id, platform)
);

create table public.site_settings (
  id boolean primary key default true check (id),
  studio_address text not null,
  studio_email text not null,
  studio_phone text not null,
  invoice_prefix text not null default 'IKKO-',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id, studio_address, studio_email, studio_phone) values (true, '69 Patricia Loop, Keysborough VIC 3173', 'info@ikkohomes.com.au', '0490 384 021');

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create trigger touch_customers before update on public.customers for each row execute procedure public.touch_updated_at();
create trigger touch_products before update on public.products for each row execute procedure public.touch_updated_at();
create trigger touch_orders before update on public.orders for each row execute procedure public.touch_updated_at();
create trigger touch_projects before update on public.projects for each row execute procedure public.touch_updated_at();
create trigger touch_blog_posts before update on public.blog_posts for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.products enable row level security;
alter table public.product_finishes enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_status_events enable row level security;
alter table public.cabinetry_drawings enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.projects enable row level security;
alter table public.project_images enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_social_links enable row level security;
alter table public.site_settings enable row level security;
alter table public.invoice_sequences enable row level security;

create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage customers" on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage customer notes" on public.customer_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage product finishes" on public.product_finishes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage product images" on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage order lines" on public.order_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage status events" on public.order_status_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage drawings" on public.cabinetry_drawings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage quotes" on public.quotes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage quote lines" on public.quote_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage invoices" on public.invoices for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage invoice lines" on public.invoice_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage projects" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage project images" on public.project_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage blog posts" on public.blog_posts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage blog social links" on public.blog_social_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage invoice sequence" on public.invoice_sequences for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads active products" on public.products for select to anon, authenticated using (is_active);
create policy "public reads active product finishes" on public.product_finishes for select to anon, authenticated using (exists(select 1 from public.products where products.id = product_finishes.product_id and products.is_active));
create policy "public reads active product images" on public.product_images for select to anon, authenticated using (exists(select 1 from public.products where products.id = product_images.product_id and products.is_active));
create policy "public reads active projects" on public.projects for select to anon, authenticated using (is_active);
create policy "public reads active project images" on public.project_images for select to anon, authenticated using (exists(select 1 from public.projects where projects.id = project_images.project_id and projects.is_active));
create policy "public reads published posts" on public.blog_posts for select to anon, authenticated using (status = 'published' and publication_date <= now());
create policy "public reads published post links" on public.blog_social_links for select to anon, authenticated using (exists(select 1 from public.blog_posts where blog_posts.id = blog_social_links.post_id and blog_posts.status = 'published' and blog_posts.publication_date <= now()));

insert into storage.buckets (id, name, public) values
  ('cabinetry-drawings', 'cabinetry-drawings', false),
  ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy "admins manage cabinetry drawings" on storage.objects for all to authenticated using (bucket_id = 'cabinetry-drawings' and public.is_admin()) with check (bucket_id = 'cabinetry-drawings' and public.is_admin());
create policy "public reads site assets" on storage.objects for select to anon, authenticated using (bucket_id = 'site-assets');
create policy "admins manage site assets" on storage.objects for all to authenticated using (bucket_id = 'site-assets' and public.is_admin()) with check (bucket_id = 'site-assets' and public.is_admin());
