-- Run against a reset local Supabase database after migrations:
-- psql "$SUPABASE_DB_URL" -f supabase/tests/quote_lifecycle_rpc.sql
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_customer uuid;
  v_order uuid;
  v_quote_v1 uuid;
  v_quote_v2 uuid;
  v_issued_instalment uuid;
  v_draft_instalment uuid;
  v_issued_invoice uuid;
  v_draft_invoice uuid;
  v_number text;
begin
  insert into public.customers (first_name, last_name, email, phone, address)
    values ('Lifecycle', 'Test', 'lifecycle-' || gen_random_uuid() || '@example.test', '0400000000', '1 Test Street') returning id into v_customer;
  insert into public.orders (order_number, customer_id, status)
    values ('LIFECYCLE-' || gen_random_uuid(), v_customer, 'invoiced') returning id into v_order;
  insert into public.quotes (order_id, version, status, total, expires_on)
    values (v_order, 1, 'confirmed', 1000, current_date + 30) returning id into v_quote_v1;
  v_number := public.ensure_quote_number(v_quote_v1);
  insert into public.quotes (order_id, version, status, quote_number_source_id, total, expires_on)
    values (v_order, 2, 'confirmed', v_quote_v1, 1000, current_date + 30) returning id into v_quote_v2;
  if public.ensure_quote_number(v_quote_v2) <> v_number then
    raise exception 'revision did not retain the original quote number';
  end if;

  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote_v1, 1, 'Deposit', 50, 500, current_date, 'issued') returning id into v_issued_instalment;
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote_v1, 2, 'Balance', 50, 500, current_date + 30, 'draft') returning id into v_draft_instalment;
  insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, payment_plan_instalment_id, due_on)
    values ('LIFE-' || gen_random_uuid(), v_order, 'Lifecycle Test', 'lifecycle@example.test', '1 Test Street', 500, 'issued', v_issued_instalment, current_date) returning id into v_issued_invoice;
  insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, payment_plan_instalment_id, due_on)
    values ('LIFE-' || gen_random_uuid(), v_order, 'Lifecycle Test', 'lifecycle@example.test', '1 Test Street', 500, 'draft', v_draft_instalment, current_date + 30) returning id into v_draft_invoice;

  -- An issued/paid row is preserved while a remaining draft row changes and moves to v2.
  perform public.replace_payment_plan_and_sync_invoices(v_order, v_quote_v2, jsonb_build_array(
    jsonb_build_object('id', v_issued_instalment, 'label', 'Deposit', 'percentage', 50, 'amount', 500, 'dueOn', current_date, 'internalNote', ''),
    jsonb_build_object('id', v_draft_instalment, 'label', 'Balance revised', 'percentage', 50, 'amount', 500, 'dueOn', current_date + 31, 'internalNote', 'revision 2')
  ));
  if (select quote_id from public.payment_plan_instalments where id = v_draft_instalment) <> v_quote_v2
    or (select quote_id from public.payment_plan_instalments where id = v_issued_instalment) <> v_quote_v1 then
    raise exception 'schedule revision linkage changed immutable data or missed the draft row';
  end if;

  -- A mixed paid/draft schedule must keep the order out of completed.
  perform public.mark_payment_plan_invoice_paid(v_issued_invoice, now(), 'deposit received');
  if (select status from public.orders where id = v_order) = 'completed' then
    raise exception 'mixed paid/draft order completed early';
  end if;

  perform public.issue_payment_plan_invoice(v_order, v_draft_invoice);
  perform public.mark_payment_plan_invoice_paid(v_draft_invoice, now(), 'balance received');
  if (select status from public.orders where id = v_order) <> 'completed'
    or exists (select 1 from public.payment_plan_instalments where order_id = v_order and status <> 'paid')
    or exists (select 1 from public.invoices where order_id = v_order and status <> 'paid') then
    raise exception 'all-paid schedule did not complete atomically';
  end if;
end;
$$;

rollback;