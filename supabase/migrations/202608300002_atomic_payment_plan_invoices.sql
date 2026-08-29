create or replace function public.assert_payment_plan_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' and not public.is_admin() then
    raise exception 'Only administrators can manage payment plans';
  end if;
end;
$$;

create or replace function public.sync_payment_plan_invoice_draft(
  p_order_id uuid,
  p_order_number text,
  p_customer_name text,
  p_customer_email text,
  p_customer_address text,
  p_instalment_id uuid,
  p_label text,
  p_amount numeric,
  p_due_on date
) returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices
  where order_id = p_order_id and payment_plan_instalment_id = p_instalment_id
  for update;

  if found and v_invoice.status <> 'draft' then
    raise exception 'Issued instalments cannot be changed.';
  end if;

  if found then
    update public.invoices
    set customer_name = p_customer_name,
        customer_email = p_customer_email,
        customer_address = p_customer_address,
        total = p_amount,
        due_on = p_due_on
    where id = v_invoice.id
    returning * into v_invoice;
  else
    insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, payment_plan_instalment_id, due_on)
    values (public.reserve_invoice_number(), p_order_id, p_customer_name, p_customer_email, p_customer_address, p_amount, 'draft', p_instalment_id, p_due_on)
    returning * into v_invoice;
  end if;

  delete from public.invoice_lines where invoice_id = v_invoice.id;
  insert into public.invoice_lines (invoice_id, display_name, unit_price, quantity, finish)
  values (v_invoice.id, p_label || ' — ' || p_order_number, p_amount, 1, null);
  return v_invoice;
end;
$$;

create or replace function public.synchronise_payment_plan_invoices(p_order_id uuid)
returns table (id uuid, invoice_number text, instalment_id uuid, status public.invoice_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_quote record;
  v_instalment record;
  v_invoice public.invoices;
begin
  perform public.assert_payment_plan_admin();
  select o.id, o.order_number, c.first_name || ' ' || c.last_name as customer_name, c.email as customer_email, c.address as customer_address
  into v_order
  from public.orders o join public.customers c on c.id = o.customer_id
  where o.id = p_order_id;
  if not found then raise exception 'Order is required.'; end if;
  if (select status from public.orders where id = p_order_id) not in ('quoted', 'invoiced') then raise exception 'Only quoted orders can be invoiced.'; end if;

  select q.id, q.total into v_quote from public.quotes q
  where q.order_id = p_order_id and q.status = 'confirmed'
  order by q.version desc limit 1;
  if not found then raise exception 'A fully priced confirmed quote is required.'; end if;
  if exists (select 1 from public.quote_lines where quote_id = v_quote.id and is_tbd) then raise exception 'A fully priced confirmed quote is required.'; end if;
  if not exists (select 1 from public.payment_plan_instalments where order_id = p_order_id) then raise exception 'A draft payment plan is required.'; end if;
  if (select coalesce(sum(amount), 0) from public.payment_plan_instalments where order_id = p_order_id) <> v_quote.total then raise exception 'Instalments must equal the confirmed quote total.'; end if;

  for v_instalment in select * from public.payment_plan_instalments where order_id = p_order_id and status = 'draft' order by sequence loop
    v_invoice := public.sync_payment_plan_invoice_draft(p_order_id, v_order.order_number, v_order.customer_name, v_order.customer_email, v_order.customer_address, v_instalment.id, v_instalment.label, v_instalment.amount, v_instalment.due_on);
    id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'draft'; return next;
  end loop;
end;
$$;

create or replace function public.replace_payment_plan_and_sync_invoices(p_order_id uuid, p_quote_id uuid, p_instalments jsonb)
returns table (id uuid, invoice_number text, instalment_id uuid, status public.invoice_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_quote record;
  v_input record;
  v_instalment public.payment_plan_instalments;
  v_invoice public.invoices;
  v_amount_total numeric := 0;
  v_percentage_total numeric := 0;
  v_sequence integer := 0;
begin
  perform public.assert_payment_plan_admin();
  if jsonb_typeof(p_instalments) <> 'array' or jsonb_array_length(p_instalments) = 0 then raise exception 'A draft payment plan is required.'; end if;
  select o.id, o.order_number, c.first_name || ' ' || c.last_name as customer_name, c.email as customer_email, c.address as customer_address
  into v_order from public.orders o join public.customers c on c.id = o.customer_id where o.id = p_order_id;
  if not found then raise exception 'Order is required.'; end if;
  if (select status from public.orders where id = p_order_id) <> 'quoted' then raise exception 'Only quoted orders can be invoiced.'; end if;
  select id, total into v_quote from public.quotes where id = p_quote_id and order_id = p_order_id and status = 'confirmed';
  if not found then raise exception 'A confirmed quote is required.'; end if;
  if exists (select 1 from public.payment_plan_instalments where order_id = p_order_id and status <> 'draft') then raise exception 'Issued instalments cannot be changed.'; end if;

  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text, label text, percentage numeric, amount numeric, "dueOn" date, "internalNote" text) loop
    if coalesce(trim(v_input.label), '') = '' or v_input.amount is null or v_input.amount <= 0 or v_input.percentage is null or v_input.percentage <= 0 or v_input."dueOn" is null then raise exception 'Invalid payment plan instalment.'; end if;
    v_amount_total := v_amount_total + v_input.amount; v_percentage_total := v_percentage_total + v_input.percentage;
  end loop;
  if round(v_amount_total, 2) <> round(v_quote.total, 2) or round(v_percentage_total, 4) <> 100 then raise exception 'Instalments must equal the confirmed quote total.'; end if;

  delete from public.invoices i
  where i.order_id = p_order_id and i.status = 'draft'
    and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id', '')::uuid = i.payment_plan_instalment_id);
  delete from public.payment_plan_instalments p
  where p.order_id = p_order_id and p.status = 'draft'
    and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id', '')::uuid = p.id);

  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text, label text, percentage numeric, amount numeric, "dueOn" date, "internalNote" text) loop
    v_sequence := v_sequence + 1;
    if nullif(v_input.id, '') is null then
      insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, internal_note, status)
      values (p_order_id, p_quote_id, v_sequence, trim(v_input.label), v_input.percentage, v_input.amount, v_input."dueOn", coalesce(trim(v_input."internalNote"), ''), 'draft')
      returning * into v_instalment;
    else
      update public.payment_plan_instalments
      set sequence = v_sequence, label = trim(v_input.label), percentage = v_input.percentage, amount = v_input.amount, due_on = v_input."dueOn", internal_note = coalesce(trim(v_input."internalNote"), '')
      where id = nullif(v_input.id, '')::uuid and order_id = p_order_id and quote_id = p_quote_id and status = 'draft'
      returning * into v_instalment;
      if not found then raise exception 'Payment plan instalment not found.'; end if;
    end if;
    v_invoice := public.sync_payment_plan_invoice_draft(p_order_id, v_order.order_number, v_order.customer_name, v_order.customer_email, v_order.customer_address, v_instalment.id, v_instalment.label, v_instalment.amount, v_instalment.due_on);
    id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'draft'; return next;
  end loop;
end;
$$;

create or replace function public.issue_payment_plan_invoice(p_order_id uuid, p_invoice_id uuid)
returns table (id uuid, invoice_number text, instalment_id uuid, status public.invoice_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_instalment public.payment_plan_instalments;
begin
  perform public.assert_payment_plan_admin();
  select * into v_invoice from public.invoices where id = p_invoice_id and order_id = p_order_id for update;
  if not found or v_invoice.payment_plan_instalment_id is null then raise exception 'A draft invoice for this order is required.'; end if;
  select * into v_instalment from public.payment_plan_instalments where id = v_invoice.payment_plan_instalment_id and order_id = p_order_id for update;
  if not found then raise exception 'A draft invoice for this order is required.'; end if;
  if v_invoice.status = 'issued' and v_instalment.status = 'issued' then
    id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'issued'; return next; return;
  end if;
  if v_invoice.status <> 'draft' or v_instalment.status <> 'draft' then raise exception 'A draft invoice for this order is required.'; end if;
  update public.invoices set status = 'issued' where id = v_invoice.id;
  update public.payment_plan_instalments set status = 'issued' where id = v_instalment.id;
  update public.orders set status = 'invoiced' where id = p_order_id and status = 'quoted';
  insert into public.order_status_events (order_id, status, note) values (p_order_id, 'invoiced', 'Invoice ' || v_invoice.invoice_number || ' issued.');
  id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'issued'; return next;
end;
$$;

revoke all on function public.assert_payment_plan_admin() from public;
revoke all on function public.sync_payment_plan_invoice_draft(uuid, text, text, text, text, uuid, text, numeric, date) from public;
revoke all on function public.synchronise_payment_plan_invoices(uuid) from public;
revoke all on function public.replace_payment_plan_and_sync_invoices(uuid, uuid, jsonb) from public;
revoke all on function public.issue_payment_plan_invoice(uuid, uuid) from public;
grant execute on function public.synchronise_payment_plan_invoices(uuid) to authenticated, service_role;
grant execute on function public.replace_payment_plan_and_sync_invoices(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.issue_payment_plan_invoice(uuid, uuid) to authenticated, service_role;