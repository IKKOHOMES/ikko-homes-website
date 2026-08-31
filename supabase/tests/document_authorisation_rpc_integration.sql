-- Executable PostgREST/RPC authorization fixture.
-- Run after `supabase db reset` locally or against a disposable staging database:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/document_authorisation_rpc_integration.sql
-- It sets the same JWT claim GUCs PostgREST uses before invoking the exposed
-- RPC signature: public.load_authorised_order_document(text, uuid).
begin;

do $$
declare
  v_admin_user uuid := gen_random_uuid();
  v_owner_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_owner_customer uuid;
  v_guest_customer uuid;
  v_owner_order uuid;
  v_guest_order uuid;
  v_owner_quote uuid;
  v_guest_quote uuid;
  v_payload jsonb;
begin
  -- auth.users rows satisfy customer.auth_user_id's FK; their email trigger
  -- creates the customer record used by the ownership fixture.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-admin-' || v_admin_user || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"Fixture","last_name":"Customer"}', now(), now()),
    (v_owner_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-owner-' || v_owner_user || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"Fixture","last_name":"Customer"}', now(), now()),
    (v_other_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-other-' || v_other_user || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"Fixture","last_name":"Customer"}', now(), now());
  insert into public.profiles (id, role) values (v_admin_user, 'admin');

  select id into v_owner_customer from public.customers where auth_user_id = v_owner_user;
  if v_owner_customer is null then
    raise exception 'auth fixture metadata did not create the owner customer';
  end if;
  insert into public.customers (first_name, last_name, email, phone, address)
    values ('Guest', 'Document', 'guest-document-' || gen_random_uuid() || '@example.test', '0400000000', '1 Guest Street')
    returning id into v_guest_customer;
  insert into public.orders (order_number, customer_id, status)
    values ('DOC-OWNER-' || gen_random_uuid(), v_owner_customer, 'quoted') returning id into v_owner_order;
  insert into public.orders (order_number, customer_id, status)
    values ('DOC-GUEST-' || gen_random_uuid(), v_guest_customer, 'quoted') returning id into v_guest_order;
  insert into public.quotes (order_id, version, status, quote_number, total, expires_on)
    values (v_owner_order, 1, 'confirmed', 'IKKO-OWNER-' || replace(v_owner_user::text, '-', ''), 110, current_date + 30) returning id into v_owner_quote;
  insert into public.quotes (order_id, version, status, quote_number, total, expires_on)
    values (v_guest_order, 1, 'confirmed', 'IKKO-GUEST-' || replace(v_guest_customer::text, '-', ''), 110, current_date + 30) returning id into v_guest_quote;
  insert into public.quote_lines (quote_id, display_name, unit_price, quantity, is_tbd)
    values (v_owner_quote, 'Owner quote', 100, 1, false), (v_guest_quote, 'Guest quote', 100, 1, false);

  -- Authenticated explicit admin may read a guest order with auth_user_id null.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);
  v_payload := public.load_authorised_order_document('quote', v_guest_quote, null);
  if v_payload #>> '{orderId}' <> v_guest_order::text then raise exception 'explicit admin could not load guest order'; end if;

  -- A non-admin cannot access a guest order, and an owner can access only own.
  perform set_config('request.jwt.claim.sub', v_other_user::text, true);
  begin
    perform public.load_authorised_order_document('quote', v_guest_quote, null);
    raise exception 'non-admin loaded guest order';
  exception when others then
    if position('Unauthorised.' in sqlerrm) = 0 then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_owner_user::text, true);
  perform public.load_authorised_order_document('quote', v_owner_quote, null);
  begin
    perform public.load_authorised_order_document('quote', v_guest_quote, null);
    raise exception 'customer loaded another order';
  exception when others then
    if position('Unauthorised.' in sqlerrm) = 0 then raise; end if;
  end;

  -- The old spoofable signature is absent; PostgREST can expose only the
  -- two-argument function and caller identity comes from its JWT claims.
  if to_regprocedure('public.load_authorised_order_document(text,uuid,uuid,boolean)') is not null
    or to_regprocedure('public.load_authorised_order_document(text,uuid,text)') is null then
    raise exception 'document RPC signature still permits caller spoofing';
  end if;
end;
$$;
-- Customer invoice/line RLS lifecycle contract using the actual authenticated
-- database role. Setup remains privileged in a temporary SECURITY DEFINER helper;
-- assertions run after SET LOCAL ROLE so table policies are genuinely evaluated.
create or replace function pg_temp.seed_invoice_rls_fixture()
returns table(owner_id uuid, customer_id uuid, order_id uuid, issued_id uuid, paid_id uuid, draft_id uuid, void_id uuid, other_issued_id uuid)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_owner uuid := gen_random_uuid();
  v_customer uuid;
  v_order uuid;
  v_other_owner uuid := gen_random_uuid();
  v_other_customer uuid;
  v_other_order uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-' || v_owner || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"Fixture","last_name":"Customer"}', now(), now());
  select id into v_customer from public.customers where auth_user_id = v_owner;
  if v_customer is null then raise exception 'RLS fixture metadata did not create the owner customer'; end if;
  insert into public.orders(order_number, customer_id, status) values ('RLS-' || gen_random_uuid(), v_customer, 'invoiced') returning id into v_order;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_other_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-other-' || v_other_owner || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"Fixture","last_name":"Customer"}', now(), now());
  select id into v_other_customer from public.customers where auth_user_id = v_other_owner;
  if v_other_customer is null then raise exception 'RLS fixture metadata did not create the other customer'; end if;
  insert into public.orders(order_number, customer_id, status) values ('RLS-OTHER-' || gen_random_uuid(), v_other_customer, 'invoiced') returning id into v_other_order;
  insert into public.invoices(invoice_number, order_id, customer_name, customer_email, customer_address, total, status)
    values ('RLS-I-' || gen_random_uuid(), v_order, 'Owner', 'owner@example.test', '1 Policy Lane', 110, 'issued') returning id into issued_id;
  insert into public.invoices(invoice_number, order_id, customer_name, customer_email, customer_address, total, status)
    values ('RLS-P-' || gen_random_uuid(), v_order, 'Owner', 'owner@example.test', '1 Policy Lane', 110, 'paid') returning id into paid_id;
  insert into public.invoices(invoice_number, order_id, customer_name, customer_email, customer_address, total, status)
    values ('RLS-D-' || gen_random_uuid(), v_order, 'Owner', 'owner@example.test', '1 Policy Lane', 110, 'draft') returning id into draft_id;
  insert into public.invoices(invoice_number, order_id, customer_name, customer_email, customer_address, total, status)
    values ('RLS-V-' || gen_random_uuid(), v_order, 'Owner', 'owner@example.test', '1 Policy Lane', 110, 'void') returning id into void_id;
  insert into public.invoices(invoice_number, order_id, customer_name, customer_email, customer_address, total, status)
    values ('RLS-OTHER-I-' || gen_random_uuid(), v_other_order, 'Other', 'other@example.test', '2 Policy Lane', 110, 'issued') returning id into other_issued_id;
  insert into public.invoice_lines(invoice_id, display_name, unit_price, quantity)
    values (issued_id, 'Issued', 100, 1), (paid_id, 'Paid', 100, 1), (draft_id, 'Draft', 100, 1), (void_id, 'Void', 100, 1), (other_issued_id, 'Other', 100, 1);
  owner_id := v_owner; customer_id := v_customer; order_id := v_order;
  return next;
end;
$$;

set local role authenticated;
do $$
declare
  v_owner uuid;
  v_customer uuid;
  v_order uuid;
  v_issued uuid;
  v_paid uuid;
  v_draft uuid;
  v_void uuid;
  v_other_issued uuid;
  v_visible_invoices integer;
  v_visible_lines integer;
begin
  select owner_id, customer_id, order_id, issued_id, paid_id, draft_id, void_id, other_issued_id
    into v_owner, v_customer, v_order, v_issued, v_paid, v_draft, v_void, v_other_issued
    from pg_temp.seed_invoice_rls_fixture();

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  select count(*) into v_visible_invoices from public.invoices where id in (v_issued, v_paid, v_draft, v_void, v_other_issued);
  if v_visible_invoices <> 2 or exists(select 1 from public.invoices where id in (v_draft, v_void, v_other_issued)) then
    raise exception 'customer invoice RLS exposed draft or void';
  end if;
  select count(*) into v_visible_lines from public.invoice_lines where invoice_id in (v_issued, v_paid, v_draft, v_void);
  if v_visible_lines <> 2 or exists(select 1 from public.invoice_lines where invoice_id in (v_draft, v_void, v_other_issued)) then
    raise exception 'customer invoice-line RLS exposed draft or void';
  end if;
  if exists(select 1 from public.invoices where id in (v_issued, v_paid) and order_id <> v_order)
     or exists(select 1 from public.invoice_lines where invoice_id in (v_issued, v_paid)
       and invoice_id not in (v_issued, v_paid)) then
    raise exception 'customer invoice RLS exposed another order';
  end if;
end;
;
rollback;
