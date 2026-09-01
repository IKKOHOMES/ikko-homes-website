import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('defines the private cabinetry bucket and order lifecycle tables', () => {
  const sql = readFileSync('supabase/migrations/202608210001_initial_admin_schema.sql', 'utf8');

  expect(sql).toContain('create table public.orders');
  expect(sql).toContain('create table public.invoices');
  expect(sql).toContain('cabinetry-drawings');
});

test('defines the managed three-level product category schema and access policies', () => {
  const sql = readFileSync('supabase/migrations/202608210004_dynamic_product_categories.sql', 'utf8');

  expect(sql).toContain('create table public.product_categories');
  expect(sql).toContain('parent_id uuid references public.product_categories');
  expect(sql).toContain('check (depth between 1 and 3)');
  expect(sql).toContain('add column category_id uuid references public.product_categories');
  expect(sql).toContain('admins manage product categories');
  expect(sql).toContain('public reads active product categories');
});

test('provisions separate administrator-managed project and blog asset buckets', () => {
  const sql = readFileSync('supabase/migrations/202608210005_project_blog_assets.sql', 'utf8');

  expect(sql).toContain("('project-assets', 'project-assets', true)");
  expect(sql).toContain("('blog-assets', 'blog-assets', true)");
  expect(sql).toContain('admins manage project assets');
  expect(sql).toContain('admins manage blog assets');
  expect(sql).toContain('public.is_admin()');
});

test('defines cloud-only home and style range storage contracts', () => {
  const sql = readFileSync('supabase/migrations/202608210006_cloud_only_content_cms.sql', 'utf8');

  expect(sql).toContain('create table public.home_page_content');
  expect(sql).toContain('create table public.home_service_pillars');
  expect(sql).toContain('create table public.style_ranges');
  expect(sql).toContain("('site-assets', 'site-assets', true)");
  expect(sql).toContain("('product-assets', 'product-assets', true)");
  expect(sql).toContain('admins manage site assets');
  expect(sql).toContain('admins manage product assets');
});

test('grants API roles access to the cloud-only content tables', () => {
  const sql = readFileSync('supabase/migrations/202608210007_cloud_content_grants.sql', 'utf8');

  expect(sql).toContain('grant select on public.home_page_content to anon');
  expect(sql).toContain('grant select, insert, update, delete on public.home_service_pillars to authenticated');
  expect(sql).toContain('grant select, insert, update, delete on public.style_ranges to authenticated');
});

test('only provisions CRM customers for explicit customer registrations', () => {
  const migrationPath = 'supabase/migrations/202608230010_isolate_admin_customer_accounts.sql';
  const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

  expect(sql).toContain("new.raw_user_meta_data ->> 'account_type', '') <> 'customer'");
  expect(sql).toContain('profiles read own profile');
});

test('grants authenticated administrators access to the singleton site settings record', () => {
  const migrationPath = 'supabase/migrations/202608230011_site_settings_grants.sql';
  const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

  expect(sql).toContain('grant select, update on public.site_settings to authenticated');
});

test('defines ordered palette modules for each style range', () => {
  const migrationPath = 'supabase/migrations/202608230012_style_range_palette_items.sql';
  const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

  expect(sql).toContain('create table public.style_range_palette_items');
  expect(sql).toContain('style_range_id uuid not null references public.style_ranges(id) on delete cascade');
  expect(sql).toContain('public reads active style range palette items');
  expect(sql).toContain('admins manage style range palette items');
});

test('defines one independently managed cabinetry product for each style range', () => {
  const migrationPath = 'supabase/migrations/202608230013_independent_cabinetry_products.sql';
  const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

  expect(sql).toContain('create table public.cabinetry_products');
  expect(sql).toContain('style_range_id uuid not null unique references public.style_ranges(id) on delete cascade');
  expect(sql).toContain('create table public.cabinetry_product_images');
  expect(sql).toContain('public reads active cabinetry products');
  expect(sql).toContain('admins manage cabinetry products');
});

test('preserves unknown-provenance release snapshots before forward cleanup', () => {
  const sql = readFileSync('supabase/migrations/202608300010_final_release_integrity.sql', 'utf8');
  const marker = sql.indexOf('update public.quotes q');
  const cleanup = sql.indexOf('delete from public.quote_payment_schedule_snapshots');
  expect(marker).toBeGreaterThan(-1);
  expect(cleanup).toBeGreaterThan(marker);
  expect(sql.slice(cleanup, cleanup + 700)).toContain('document_generated_at is not null');
});

test('runs invoice RLS assertions as authenticated with privileged fixture setup', () => {
  const sql = readFileSync('supabase/tests/document_authorisation_rpc_integration.sql', 'utf8');
  expect(sql).toContain('create or replace function pg_temp.seed_invoice_rls_fixture()');
  expect(sql).toContain('security definer');
  expect(sql).toContain('set local role authenticated;');
  expect(sql).toContain('RLS-OTHER-I-');
});
test('keeps server-only administrator provisioning able to read and create profiles', () => {
  const migrationPath = 'supabase/migrations/202609010016_admin_provisioning_permissions.sql';
  const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

  expect(sql).toContain('grant select on public.profiles to service_role');
  expect(sql).toContain('insert into public.profiles (id, role)');
  expect(sql).toContain("values (p_profile_id, case when p_is_admin then 'admin' else 'customer' end)");
});

test('allows authenticated administrators to persist quote edits while RLS remains authoritative', () => {
  const migrationPath = 'supabase/migrations/202609010017_admin_quote_save_grants.sql';
  const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

  expect(sql).toContain('grant select, insert, update, delete on public.quotes, public.quote_lines to authenticated');
  expect(sql).toContain('grant insert on public.order_status_events to authenticated');
  expect(sql).not.toContain(' to anon');
});
