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

rollback;
