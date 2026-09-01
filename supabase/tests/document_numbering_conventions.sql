-- Run against a reset local Supabase database after migrations:
-- psql "$SUPABASE_DB_URL" -f supabase/tests/document_numbering_conventions.sql
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_customer uuid;
  v_order uuid;
  v_quote uuid;
  v_first uuid;
  v_twenty_seventh uuid;
  v_quote_number text;
begin
  if public.excel_milestone_suffix(1) <> 'A'
    or public.excel_milestone_suffix(26) <> 'Z'
    or public.excel_milestone_suffix(27) <> 'AA'
    or public.excel_milestone_suffix(52) <> 'AZ'
    or public.excel_milestone_suffix(53) <> 'BA' then
    raise exception 'Excel milestone suffix conversion is incorrect';
  end if;

  insert into public.customers (first_name, last_name, email, phone, address)
    values ('Numbering', 'Test', 'numbering-' || gen_random_uuid() || '@example.test', '0400000000', '1 Test Street')
    returning id into v_customer;
  insert into public.orders (order_number, customer_id, status)
    values ('NUMBERING-' || gen_random_uuid(), v_customer, 'new')
    returning id into v_order;
  insert into public.quotes (order_id, version, status, total, expires_on)
    values (v_order, 1, 'confirmed', 1000, current_date + 30)
    returning id into v_quote;
  insert into public.quote_lines (quote_id, display_name, unit_price, quantity, is_tbd)
    values (v_quote, 'Numbering test', 1000, 1, false);

  v_quote_number := public.ensure_quote_number(v_quote);
  if v_quote_number !~ '^ORD-[0-9]{6}0001$' then
    raise exception 'New quote number has wrong format: %', v_quote_number;
  end if;

  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote, 1, 'First payment', 50, 500, current_date, 'draft')
    returning id into v_first;
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote, 27, 'Twenty-seventh payment', 50, 500, current_date + 30, 'draft')
    returning id into v_twenty_seventh;

  if public.reserve_payment_plan_invoice_number(v_order, v_first) !~ '^INV-[0-9]{6}0001A$'
    or public.reserve_payment_plan_invoice_number(v_order, v_twenty_seventh) !~ '^INV-[0-9]{6}0001AA$' then
    raise exception 'Invoice milestone number does not use quote sequence and payment sequence';
  end if;
end;
$$;

-- Legacy and new quote numbers may share a month and payment sequence, but
-- their actual invoice inserts must remain globally unique.
do $$
declare
  v_customer uuid;
  v_new_order uuid;
  v_legacy_order uuid;
  v_new_quote uuid;
  v_legacy_quote uuid;
  v_new_plan uuid;
  v_legacy_plan uuid;
  v_new_invoice public.invoices;
  v_legacy_invoice public.invoices;
  v_draft_quote uuid;
  v_rejected boolean := false;
  v_period text := to_char(current_date, 'YYYYMM');
begin
  insert into public.customers (first_name, last_name, email, phone, address)
    values ('Collision', 'Test', 'collision-' || gen_random_uuid() || '@example.test', '0400000000', '1 Test Street')
    returning id into v_customer;
  insert into public.orders (order_number, customer_id, status)
    values ('NUMBERING-NEW-' || gen_random_uuid(), v_customer, 'new')
    returning id into v_new_order;
  insert into public.orders (order_number, customer_id, status)
    values ('NUMBERING-LEGACY-' || gen_random_uuid(), v_customer, 'new')
    returning id into v_legacy_order;

  -- A persisted historical INV root must be considered when the quote number
  -- is allocated, not when its first draft invoice is allocated. The quote is
  -- deliberately drafted in a prior month: confirmation assigns this month's
  -- ORD prefix.
  insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, due_on)
    values ('INV-' || v_period || '0002A', v_legacy_order, 'Collision Test', 'collision@example.test', '1 Test Street', 100, 'issued', current_date);
  insert into public.quotes (order_id, version, status, total, expires_on, created_at)
    values (v_new_order, 1, 'confirmed', 100, current_date + 30, current_date - interval '2 months')
    returning id into v_new_quote;
  insert into public.quote_lines (quote_id, display_name, unit_price, quantity, is_tbd)
    values (v_new_quote, 'New numbering quote', 100, 1, false);
  if public.ensure_quote_number(v_new_quote) <> 'ORD-' || v_period || '0003' then
    raise exception 'Quote number did not use confirmation month or skip the reserved invoice root';
  end if;

  insert into public.quotes (order_id, version, status, quote_number, total, expires_on, created_at)
    values (v_legacy_order, 1, 'confirmed', 'IKKO' || v_period || '0001', 100, current_date + 30, current_date + interval '1 month')
    returning id into v_legacy_quote;
  insert into public.quote_lines (quote_id, display_name, unit_price, quantity, is_tbd)
    values (v_legacy_quote, 'Legacy numbering quote', 100, 1, false);

  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_new_order, v_new_quote, 1, 'First payment', 100, 100, current_date, 'draft')
    returning id into v_new_plan;
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_legacy_order, v_legacy_quote, 1, 'First payment', 100, 100, current_date, 'draft')
    returning id into v_legacy_plan;

  -- The legacy record remains untouched; a new ORD quote is allocated around
  -- its INV root, so the invoice keeps the same root as the quote.
  insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, due_on)
    values ('IKKO-9999', v_legacy_order, 'Collision Test', 'collision@example.test', '1 Test Street', 100, 'issued', current_date);

  v_new_invoice := public.sync_payment_plan_invoice_draft(v_new_order, 'NUMBERING-NEW', 'Collision Test', 'collision@example.test', '1 Test Street', v_new_plan, 'First payment', 100, current_date);
  v_legacy_invoice := public.sync_payment_plan_invoice_draft(v_legacy_order, 'NUMBERING-LEGACY', 'Collision Test', 'collision@example.test', '1 Test Street', v_legacy_plan, 'First payment', 100, current_date);
  if v_new_invoice.invoice_number <> 'INV-' || v_period || '0003A'
    or v_legacy_invoice.invoice_number !~ '^IKKO-'
    or v_new_invoice.invoice_number = v_legacy_invoice.invoice_number then
    raise exception 'Legacy/new invoice allocation collided: % / %', v_new_invoice.invoice_number, v_legacy_invoice.invoice_number;
  end if;
  if (select invoice_number from public.invoices where order_id = v_legacy_order and payment_plan_instalment_id is null and invoice_number = 'INV-' || v_period || '0002A') is null
    or (select invoice_number from public.invoices where order_id = v_legacy_order and invoice_number = 'IKKO-9999') is null
    or (select quote_number from public.quotes where id = v_legacy_quote) <> 'IKKO' || v_period || '0001' then
    raise exception 'Historical issued IKKO value was rewritten';
  end if;

  insert into public.quotes (order_id, version, status, total, expires_on)
    values (v_new_order, 2, 'draft', 100, current_date + 30)
    returning id into v_draft_quote;
  begin
    perform public.ensure_quote_number(v_draft_quote);
  exception when others then
    if position('Only confirmed quotes can receive a quote number.' in sqlerrm) = 0 then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Draft quote received a document number'; end if;
end;
$$;

-- A quote number can only be assigned to a confirmed quote whose source is a
-- confirmed quote belonging to the same order.
do $$
declare
  v_customer uuid;
  v_order uuid;
  v_other_order uuid;
  v_source uuid;
  v_quote uuid;
  v_rejected boolean;
begin
  insert into public.customers (first_name, last_name, email, phone, address)
    values ('Source', 'Test', 'source-' || gen_random_uuid() || '@example.test', '0400000000', '1 Test Street')
    returning id into v_customer;
  insert into public.orders (order_number, customer_id, status)
    values ('NUMBERING-SOURCE-' || gen_random_uuid(), v_customer, 'new')
    returning id into v_order;
  insert into public.orders (order_number, customer_id, status)
    values ('NUMBERING-OTHER-' || gen_random_uuid(), v_customer, 'new')
    returning id into v_other_order;
  insert into public.quotes (order_id, version, status, total, expires_on)
    values (v_order, 1, 'draft', 100, current_date + 30)
    returning id into v_source;
  insert into public.quotes (order_id, version, status, quote_number_source_id, total, expires_on)
    values (v_order, 2, 'confirmed', v_source, 100, current_date + 30)
    returning id into v_quote;
  insert into public.quotes (order_id, version, status, total, expires_on)
    values (v_other_order, 1, 'confirmed', 100, current_date + 30);
  v_rejected := false;
  begin
    perform public.ensure_quote_number(v_quote);
  exception when others then
    if position('A confirmed quote number source is required.' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Quote with draft source received a document number'; end if;

  update public.quotes set status = 'confirmed', quote_number_source_id = null where id = v_source;
  update public.quotes set quote_number_source_id = (
    select id from public.quotes where order_id = v_other_order limit 1
  ) where id = v_quote;
  v_rejected := false;
  begin
    perform public.ensure_quote_number(v_quote);
  exception when others then
    if position('A confirmed quote number source is required.' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Quote with cross-order source received a document number'; end if;
end;
$$;

-- Once invoices exist, their letters are tied to the stored schedule sequence.
-- Editing row details remains supported, but reordering existing rows is not.
do $$
declare
  v_customer uuid;
  v_order uuid;
  v_quote uuid;
  v_first uuid;
  v_second uuid;
  v_rejected boolean := false;
begin
  insert into public.customers (first_name, last_name, email, phone, address)
    values ('Schedule', 'Order', 'schedule-' || gen_random_uuid() || '@example.test', '0400000000', '1 Test Street')
    returning id into v_customer;
  insert into public.orders (order_number, customer_id, status)
    values ('NUMBERING-SCHEDULE-' || gen_random_uuid(), v_customer, 'quoted')
    returning id into v_order;
  insert into public.quotes (order_id, version, status, total, expires_on)
    values (v_order, 1, 'confirmed', 100, current_date + 30)
    returning id into v_quote;
  insert into public.quote_lines (quote_id, display_name, unit_price, quantity, is_tbd)
    values (v_quote, 'Schedule quote', 100, 1, false);
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote, 1, 'Deposit', 50, 50, current_date, 'draft')
    returning id into v_first;
  insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, status)
    values (v_order, v_quote, 2, 'Final', 50, 50, current_date + 30, 'draft')
    returning id into v_second;
  perform public.sync_payment_plan_invoice_draft(v_order, 'NUMBERING-SCHEDULE', 'Schedule Order', 'schedule@example.test', '1 Test Street', v_first, 'Deposit', 50, current_date);
  perform public.sync_payment_plan_invoice_draft(v_order, 'NUMBERING-SCHEDULE', 'Schedule Order', 'schedule@example.test', '1 Test Street', v_second, 'Final', 50, current_date + 30);

  begin
    perform public.replace_payment_plan_and_sync_invoices(v_order, v_quote, jsonb_build_array(
      jsonb_build_object('id', v_second, 'label', 'Final', 'percentage', 50, 'amount', 50, 'dueOn', current_date + 30, 'internalNote', ''),
      jsonb_build_object('id', v_first, 'label', 'Deposit', 'percentage', 50, 'amount', 50, 'dueOn', current_date, 'internalNote', '')
    ));
  exception when others then
    if position('Draft invoices lock payment plan sequence.' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Draft invoice schedule reordering was accepted'; end if;

  perform public.replace_payment_plan_and_sync_invoices(v_order, v_quote, jsonb_build_array(
    jsonb_build_object('id', v_first, 'label', 'Deposit revised', 'percentage', 40, 'amount', 40, 'dueOn', current_date + 1, 'internalNote', 'updated'),
    jsonb_build_object('id', v_second, 'label', 'Final revised', 'percentage', 60, 'amount', 60, 'dueOn', current_date + 31, 'internalNote', 'updated')
  ));
  if (select sequence from public.payment_plan_instalments where id = v_first) <> 1
    or (select sequence from public.payment_plan_instalments where id = v_second) <> 2
    or (select total from public.invoices where payment_plan_instalment_id = v_first) <> 40
    or (select total from public.invoices where payment_plan_instalment_id = v_second) <> 60 then
    raise exception 'Draft invoice schedule details did not update without reordering';
  end if;
end;
$$;
rollback;
