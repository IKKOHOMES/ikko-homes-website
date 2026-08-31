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
    (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-admin-' || v_admin_user || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{}', now(), now()),
    (v_owner_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-owner-' || v_owner_user || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{}', now(), now()),
    (v_other_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'document-other-' || v_other_user || '@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email"}', '{}', now(), now());
  insert into public.profiles (id, role) values (v_admin_user, 'admin');

  select id into v_owner_customer from public.customers where auth_user_id = v_owner_user;
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
-- Customer invoice/line RLS lifecycle contract using PostgREST JWT claim GUCs.
do $$
declare v_owner uuid:=gen_random_uuid(); v_customer uuid; v_order uuid; v_issued uuid; v_paid uuid; v_draft uuid; v_void uuid;
begin
  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values (v_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-'||v_owner||'@example.test',crypt('password',gen_salt('bf')),now(),'{"provider":"email"}','{}',now(),now());
  select id into v_customer from public.customers where auth_user_id=v_owner;
  insert into public.orders(order_number,customer_id,status) values ('RLS-'||gen_random_uuid(),v_customer,'invoiced') returning id into v_order;
  insert into public.invoices(invoice_number,order_id,customer_name,customer_email,customer_address,total,status) values ('RLS-I-'||gen_random_uuid(),v_order,'Owner','owner@example.test','1 Policy Lane',110,'issued') returning id into v_issued;
  insert into public.invoices(invoice_number,order_id,customer_name,customer_email,customer_address,total,status) values ('RLS-P-'||gen_random_uuid(),v_order,'Owner','owner@example.test','1 Policy Lane',110,'paid') returning id into v_paid;
  insert into public.invoices(invoice_number,order_id,customer_name,customer_email,customer_address,total,status) values ('RLS-D-'||gen_random_uuid(),v_order,'Owner','owner@example.test','1 Policy Lane',110,'draft') returning id into v_draft;
  insert into public.invoices(invoice_number,order_id,customer_name,customer_email,customer_address,total,status) values ('RLS-V-'||gen_random_uuid(),v_order,'Owner','owner@example.test','1 Policy Lane',110,'void') returning id into v_void;
  insert into public.invoice_lines(invoice_id,display_name,unit_price,quantity) values (v_issued,'Issued',100,1),(v_paid,'Paid',100,1),(v_draft,'Draft',100,1),(v_void,'Void',100,1);
  perform set_config('request.jwt.claim.role','authenticated',true); perform set_config('request.jwt.claim.sub',v_owner::text,true);
  if (select count(*) from public.invoices where id in(v_issued,v_paid,v_draft,v_void))<>2 or exists(select 1 from public.invoices where id in(v_draft,v_void)) then raise exception 'customer invoice RLS exposed draft or void'; end if;
  if (select count(*) from public.invoice_lines where invoice_id in(v_issued,v_paid,v_draft,v_void))<>2 or exists(select 1 from public.invoice_lines where invoice_id in(v_draft,v_void)) then raise exception 'customer invoice-line RLS exposed draft or void'; end if;
end;
$$;
rollback;
