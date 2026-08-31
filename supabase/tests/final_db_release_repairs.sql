-- Forward-migration regression fixture for Task 6H.
-- Run after `supabase db reset` against a disposable local database:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/final_db_release_repairs.sql
-- The fixture creates rows that look like the 008-011 legacy state, reruns the
-- idempotent forward migration, then asserts the observable database behaviour.

begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_customer uuid;
  v_order uuid;
  v_quote_v1 uuid;
  v_quote_v2 uuid;
  v_quote_v3 uuid;
  v_issued_instalment uuid;
  v_v2_draft uuid;
  v_v3_draft uuid;
begin
  insert into public.customers (first_name, last_name, email, phone, address)
  values ('Final', 'Migration', 'final-migration-' || gen_random_uuid() || '@example.test', '0400000000', '12 Evidence Street')
  returning id into v_customer;
  insert into public.orders (order_number, customer_id, status)
  values ('FINAL-' || gen_random_uuid(), v_customer, 'invoiced')
  returning id into v_order;
  insert into public.quotes (order_id, version, status, quote_number, total, expires_on)
  values (v_order, 1, 'confirmed', 'IKKO-FINAL-' || replace(gen_random_uuid()::text, '-', ''), 1000, current_date + 30)
  returning id into v_quote_v1;
  insert into public.quotes (order_id, version, status, total, expires_on)
  values (v_order, 2, 'confirmed', 1000, current_date + 30)
  returning id into v_quote_v2;
  insert into public.quotes (order_id, version, status, total, expires_on)
  values (v_order, 3, 'confirmed', 1000, current_date + 30)
  returning id into v_quote_v3;

  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
  values (v_order, v_quote_v1, 1, 'Prior issued deposit', 50, 500, current_date, 'issued')
  returning id into v_issued_instalment;
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
  values (v_order, v_quote_v2, 2, 'Current v2 balance', 50, 500, current_date + 30, 'draft')
  returning id into v_v2_draft;
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
  values (v_order, v_quote_v3, 3, 'Later v3 draft', 10, 100, current_date + 45, 'draft')
  returning id into v_v3_draft;
  insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, payment_plan_instalment_id, due_on)
  values ('FINAL-I-' || gen_random_uuid(), v_order, 'Final Migration', 'final@example.test', '12 Evidence Street', 500, 'issued', v_issued_instalment, current_date);

  -- Simulate the false snapshots and markers produced when 008-011 apply together.
  insert into public.quote_payment_schedule_snapshots (quote_id, payment_schedule)
  values
    (v_quote_v1, '[{"description":"proven invoice snapshot"}]'::jsonb),
    (v_quote_v2, '[{"description":"unreleased v2 snapshot"}]'::jsonb);
  update public.quotes set document_generated_at = now() where id in (v_quote_v1, v_quote_v2);

  perform set_config('task6h.order_id', v_order::text, true);
  perform set_config('task6h.quote_v1', v_quote_v1::text, true);
  perform set_config('task6h.quote_v2', v_quote_v2::text, true);
end;
$$;

\ir ../migrations/202608300012_final_db_release_repairs.sql

do $$
declare
  v_order uuid := current_setting('task6h.order_id')::uuid;
  v_quote_v1 uuid := current_setting('task6h.quote_v1')::uuid;
  v_quote_v2 uuid := current_setting('task6h.quote_v2')::uuid;
  v_document jsonb;
begin
  if not exists (select 1 from public.quote_payment_schedule_snapshots where quote_id = v_quote_v1) then
    raise exception 'issued-invoice evidence did not preserve its legacy snapshot';
  end if;
  if exists (select 1 from public.quote_payment_schedule_snapshots where quote_id = v_quote_v2)
    or (select document_generated_at from public.quotes where id = v_quote_v2) is not null then
    raise exception 'unreleased legacy quote remained frozen after forward repair';
  end if;

  v_document := public.load_authorised_order_document('quote', v_quote_v2, null);
  if v_document #>> '{input,paymentSchedule,0,description}' <> 'Prior issued deposit'
    or v_document #>> '{input,paymentSchedule,1,description}' <> 'Current v2 balance'
    or jsonb_array_length(v_document #> '{input,paymentSchedule}') <> 2
    or (v_document #> '{input,paymentSchedule}')::text like '%Later v3 draft%' then
    raise exception 'v2 snapshot did not preserve prior issued milestones and exclude later drafts';
  end if;
end;
$$;

-- RLS and grants protect counters/snapshots from normal authenticated users.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.quote_number_counters'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.quote_payment_schedule_snapshots'::regclass) then
    raise exception 'internal counter or snapshot table has RLS disabled';
  end if;
  if has_table_privilege('authenticated', 'public.quote_number_counters', 'select')
    or has_table_privilege('authenticated', 'public.quote_payment_schedule_snapshots', 'select')
    or has_table_privilege('anon', 'public.quote_number_counters', 'select')
    or has_table_privilege('anon', 'public.quote_payment_schedule_snapshots', 'select') then
    raise exception 'public table privilege remained on an internal quote table';
  end if;
  if not has_table_privilege('service_role', 'public.quote_payment_schedule_snapshots', 'select') then
    raise exception 'service role lost required snapshot read access';
  end if;
end;
$$;

set local role authenticated;
do $$
begin
  begin
    perform 1 from public.quote_number_counters limit 1;
    raise exception 'authenticated role read quote counters';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform 1 from public.quote_payment_schedule_snapshots limit 1;
    raise exception 'authenticated role read quote schedule snapshots';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

rollback;