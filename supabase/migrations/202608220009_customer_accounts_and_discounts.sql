-- Customer self-service accounts must be distinct from internal admin profiles.
alter table public.customers
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100);

alter table public.orders
  add column if not exists discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  add column if not exists furniture_discount_total numeric(12,2) not null default 0
    check (furniture_discount_total >= 0);

alter table public.order_lines add column if not exists list_unit_price numeric(12,2);
update public.order_lines
set list_unit_price = unit_price
where line_kind = 'furniture' and list_unit_price is null;

alter table public.order_lines
  add constraint order_lines_list_price_matches_kind check (
    (line_kind = 'furniture' and list_unit_price is not null and list_unit_price >= unit_price)
    or (line_kind = 'cabinetry' and list_unit_price is null)
  );

create unique index if not exists customers_email_lower_unique on public.customers (lower(email));

-- Existing profiles are intentionally retained. Only staff explicitly provisioned
-- into public.profiles are internal admins from this migration forward.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_profile_for_new_user();

create or replace function public.create_customer_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  customer_email text := lower(coalesce(new.email, ''));
  customer_first_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 'Customer');
  customer_last_name text := coalesce(trim(new.raw_user_meta_data ->> 'last_name'), '');
begin
  if customer_email = '' then return new; end if;

  update public.customers
  set auth_user_id = new.id
  where lower(email) = customer_email and auth_user_id is null;

  if not found then
    insert into public.customers (first_name, last_name, email, phone, address, auth_user_id)
    values (customer_first_name, customer_last_name, customer_email, '', '', new.id)
    on conflict ((lower(email))) do update
      set auth_user_id = excluded.auth_user_id
      where public.customers.auth_user_id is null;
  end if;
  return new;
end;
$$;

create trigger on_auth_customer_created
after insert on auth.users for each row execute procedure public.create_customer_for_new_user();

create or replace function public.is_customer_owner(customer_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(
    select 1 from public.customers
    where id = customer_id and auth_user_id = auth.uid()
  );
$$;

revoke all on function public.is_customer_owner(uuid) from public;
grant execute on function public.is_customer_owner(uuid) to authenticated;

create policy "customers read own profile" on public.customers
for select to authenticated using (auth_user_id = auth.uid());
create policy "customers read own orders" on public.orders
for select to authenticated using (public.is_customer_owner(customer_id));
create policy "customers read own order lines" on public.order_lines
for select to authenticated using (exists (
  select 1 from public.orders where orders.id = order_lines.order_id and public.is_customer_owner(orders.customer_id)
));
create policy "customers read own order events" on public.order_status_events
for select to authenticated using (exists (
  select 1 from public.orders where orders.id = order_status_events.order_id and public.is_customer_owner(orders.customer_id)
));
create policy "customers read own cabinetry drawing metadata" on public.cabinetry_drawings
for select to authenticated using (exists (
  select 1 from public.order_lines join public.orders on orders.id = order_lines.order_id
  where order_lines.id = cabinetry_drawings.order_line_id and public.is_customer_owner(orders.customer_id)
));
create policy "customers read own quotes" on public.quotes
for select to authenticated using (exists (
  select 1 from public.orders where orders.id = quotes.order_id and public.is_customer_owner(orders.customer_id)
));
create policy "customers read own quote lines" on public.quote_lines
for select to authenticated using (exists (
  select 1 from public.quotes join public.orders on orders.id = quotes.order_id
  where quotes.id = quote_lines.quote_id and public.is_customer_owner(orders.customer_id)
));
create policy "customers read own invoices" on public.invoices
for select to authenticated using (exists (
  select 1 from public.orders where orders.id = invoices.order_id and public.is_customer_owner(orders.customer_id)
));
create policy "customers read own invoice lines" on public.invoice_lines
for select to authenticated using (exists (
  select 1 from public.invoices join public.orders on orders.id = invoices.order_id
  where invoices.id = invoice_lines.invoice_id and public.is_customer_owner(orders.customer_id)
));

grant select on public.customers to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_lines to authenticated;
grant select on public.order_status_events to authenticated;
grant select on public.cabinetry_drawings to authenticated;
grant select on public.quotes to authenticated;
grant select on public.quote_lines to authenticated;
grant select on public.invoices to authenticated;
grant select on public.invoice_lines to authenticated;
