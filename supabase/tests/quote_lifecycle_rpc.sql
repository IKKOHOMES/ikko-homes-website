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
  v_legacy_revision uuid;
  v_quote_v4 uuid;
  v_document jsonb;
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
  -- A direct legacy-style number on a new revision is normalised to v1 source.
  insert into public.quotes (order_id, version, status, quote_number, total, expires_on)
    values (v_order, 3, 'confirmed', 'LEGACY-' || gen_random_uuid(), 1000, current_date + 30) returning id into v_legacy_revision;
  if (select quote_number_source_id from public.quotes where id = v_legacy_revision) <> v_quote_v1
    or (select quote_number from public.quotes where id = v_legacy_revision) is not null then
    raise exception 'legacy revision number was not normalised to the earliest quote source';
  end if;

  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote_v1, 1, 'Deposit', 50, 500, current_date, 'issued') returning id into v_issued_instalment;
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote_v1, 2, 'Balance', 50, 500, current_date + 30, 'draft') returning id into v_draft_instalment;
  insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, payment_plan_instalment_id, due_on)
    values ('LIFE-' || gen_random_uuid(), v_order, 'Lifecycle Test', 'lifecycle@example.test', '1 Test Street', 500, 'issued', v_issued_instalment, current_date) returning id into v_issued_invoice;
  insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, payment_plan_instalment_id, due_on)
    values ('LIFE-' || gen_random_uuid(), v_order, 'Lifecycle Test', 'lifecycle@example.test', '1 Test Street', 500, 'draft', v_draft_instalment, current_date + 30) returning id into v_draft_invoice;

  -- A revised quote confirmed after an issued invoice must not regress the
  -- order from invoiced to quoted; final payment can still complete it.
  insert into public.quotes (order_id, version, status, quote_number_source_id, total, expires_on)
    values (v_order, 4, 'draft', v_quote_v1, 1000, current_date + 30) returning id into v_quote_v4;
  insert into public.quote_lines (quote_id, display_name, unit_price, quantity, is_tbd)
    values (v_quote_v4, 'Lifecycle revision', 1000, 1, false);
  perform public.confirm_quote(v_order, v_quote_v4);
  if (select status from public.orders where id = v_order) <> 'invoiced' then
    raise exception 'confirming a revision regressed an invoiced order';
  end if;

  -- Duplicate submitted IDs could otherwise update one stored draft twice while
  -- the duplicated input total still equals the quote total.
  begin
    perform public.replace_payment_plan_and_sync_invoices(v_order, v_quote_v2, jsonb_build_array(
      jsonb_build_object('id', v_issued_instalment, 'label', 'Deposit', 'percentage', 50, 'amount', 500, 'dueOn', current_date, 'internalNote', ''),
      jsonb_build_object('id', v_draft_instalment, 'label', 'Balance one', 'percentage', 25, 'amount', 250, 'dueOn', current_date + 30, 'internalNote', ''),
      jsonb_build_object('id', upper(v_draft_instalment::text), 'label', 'Balance two', 'percentage', 25, 'amount', 250, 'dueOn', current_date + 30, 'internalNote', '')
    ));
    raise exception 'duplicate schedule IDs were accepted';
  exception when others then
    if position('IDs must be unique' in sqlerrm) = 0 then raise; end if;
  end;
  -- An issued/paid row is preserved while a remaining draft row changes and moves to v2.
  perform public.replace_payment_plan_and_sync_invoices(v_order, v_quote_v2, jsonb_build_array(
    jsonb_build_object('id', v_issued_instalment, 'label', 'Deposit', 'percentage', 50, 'amount', 500, 'dueOn', current_date, 'internalNote', ''),
    jsonb_build_object('id', v_draft_instalment, 'label', 'Balance revised', 'percentage', 50, 'amount', 500, 'dueOn', current_date + 31, 'internalNote', 'revision 2')
  ));
  if (select quote_id from public.payment_plan_instalments where id = v_draft_instalment) <> v_quote_v2
    or (select quote_id from public.payment_plan_instalments where id = v_issued_instalment) <> v_quote_v1 then
    raise exception 'schedule revision linkage changed immutable data or missed the draft row';
  end if;
  -- First document generation freezes the latest same-revision schedule.
  v_document := public.load_authorised_order_document('quote', v_quote_v2);
  perform public.replace_payment_plan_and_sync_invoices(v_order, v_quote_v2, jsonb_build_array(
    jsonb_build_object('id', v_issued_instalment, 'label', 'Deposit', 'percentage', 50, 'amount', 500, 'dueOn', current_date, 'internalNote', ''),
    jsonb_build_object('id', v_draft_instalment, 'label', 'Balance changed after release', 'percentage', 50, 'amount', 500, 'dueOn', current_date + 32, 'internalNote', 'later edit')
  ));
  if (select payment_schedule::text from public.quote_payment_schedule_snapshots where quote_id = v_quote_v2) like '%changed after release%'
    or v_document #>> '{input,paymentSchedule,1,description}' <> 'Balance revised' then
    raise exception 'released quote schedule snapshot was overwritten';
  end if;

  -- A mixed paid/draft schedule must keep the order out of completed.
  perform public.mark_payment_plan_invoice_paid(v_issued_invoice, now(), 'deposit received');
  if (select status from public.orders where id = v_order) = 'completed' then
    raise exception 'mixed paid/draft order completed early';
  end if;

  perform public.issue_payment_plan_invoice(v_order, v_draft_invoice);
  -- Multi-session lock-order coverage lives in payment_plan_lock_order_two_session.sql.
  -- This single session verifies the overdue lifecycle only; it cannot prove concurrency.
  update public.payment_plan_instalments set status = 'overdue' where id = v_draft_instalment;
  if (select status from public.invoices where id = v_draft_invoice) <> 'issued' then raise exception 'overdue is an instalment state; invoice must remain issued'; end if;
  perform public.mark_payment_plan_invoice_paid(v_draft_invoice, now(), 'overdue balance received');
  if (select status from public.orders where id = v_order) <> 'completed'
    or exists (select 1 from public.payment_plan_instalments where order_id = v_order and status <> 'paid')
    or exists (select 1 from public.invoices where order_id = v_order and status <> 'paid') then
    raise exception 'all-paid schedule did not complete atomically';
  end if;
end;
$$;

rollback;