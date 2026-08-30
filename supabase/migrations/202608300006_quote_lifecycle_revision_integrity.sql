-- Preserve one visible IKKO number across quote revisions while retaining immutable
-- invoice/payment-plan snapshots on the quote revision that created them.
alter table public.quotes
  add column if not exists quote_number_source_id uuid references public.quotes(id) on delete restrict;

create index if not exists quotes_quote_number_source_id_idx
  on public.quotes (quote_number_source_id);

create or replace function public.ensure_quote_number(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_source public.quotes;
  v_period char(6);
  v_sequence integer;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only administrators can assign quote numbers';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote % does not exist', p_quote_id; end if;
  if v_quote.quote_number is not null then return v_quote.quote_number; end if;

  select * into v_source
  from public.quotes
  where id = coalesce(v_quote.quote_number_source_id, v_quote.id)
  for update;
  if not found then raise exception 'Quote number source is unavailable.'; end if;
  if v_source.quote_number is not null then return v_source.quote_number; end if;

  v_period := to_char(v_source.created_at, 'YYYYMM');
  insert into public.quote_number_counters (period, last_sequence)
  values (v_period, 1)
  on conflict (period) do update
    set last_sequence = public.quote_number_counters.last_sequence + 1
  returning last_sequence into v_sequence;

  update public.quotes
  set quote_number = 'IKKO' || v_period || lpad(v_sequence::text, 4, '0')
  where id = v_source.id
  returning quote_number into v_source.quote_number;
  return v_source.quote_number;
end;
$$;

-- The first revision establishes the stable number source.  Later revisions
-- retain the source rather than duplicating the unique quote_number value.
create or replace function public.link_quote_revision_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quote_number is null and new.quote_number_source_id is null and new.version > 1 then
    select coalesce(q.quote_number_source_id, q.id)
      into new.quote_number_source_id
    from public.quotes q
    where q.order_id = new.order_id and q.id <> new.id
    order by q.version asc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists link_quote_revision_number on public.quotes;
create trigger link_quote_revision_number
before insert on public.quotes
for each row execute procedure public.link_quote_revision_number();

create or replace function public.replace_payment_plan_and_sync_invoices(
  p_order_id uuid, p_quote_id uuid, p_instalments jsonb
)
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
    into v_order from public.orders o join public.customers c on c.id = o.customer_id where o.id = p_order_id for update;
  if not found then raise exception 'Order is required.'; end if;
  if v_order.id is null then raise exception 'Order is required.'; end if;
  select id, total into v_quote from public.quotes where id = p_quote_id and order_id = p_order_id and status = 'confirmed' for update;
  if not found then raise exception 'A confirmed quote is required.'; end if;
  perform 1 from public.payment_plan_instalments where order_id = p_order_id for update;
  if exists (
    select 1 from public.payment_plan_instalments p
    where p.order_id = p_order_id and p.status <> 'draft'
      and not exists (select 1 from jsonb_array_elements(p_instalments) e where e->>'id' = p.id::text)
  ) then raise exception 'Issued or paid instalments cannot be removed.'; end if;

  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text, label text, percentage numeric, amount numeric, "dueOn" date, "internalNote" text) loop
    if coalesce(trim(v_input.label), '') = '' or v_input.amount is null or v_input.amount <= 0 or v_input.percentage is null or v_input.percentage <= 0 or v_input."dueOn" is null then raise exception 'Invalid payment plan instalment.'; end if;
    v_amount_total := v_amount_total + v_input.amount;
    v_percentage_total := v_percentage_total + v_input.percentage;
  end loop;
  if round(v_amount_total, 2) <> round(v_quote.total, 2) or round(v_percentage_total, 4) <> 100 then raise exception 'Instalments must equal the confirmed quote total.'; end if;

  -- Only draft rows can disappear.  Issued/paid rows and their invoice links stay intact.
  delete from public.invoices i
  where i.order_id = p_order_id and i.status = 'draft'
    and not exists (select 1 from jsonb_array_elements(p_instalments) e where e->>'id' = i.payment_plan_instalment_id::text);
  delete from public.payment_plan_instalments p
  where p.order_id = p_order_id and p.status = 'draft'
    and not exists (select 1 from jsonb_array_elements(p_instalments) e where e->>'id' = p.id::text);

  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text, label text, percentage numeric, amount numeric, "dueOn" date, "internalNote" text) loop
    v_sequence := v_sequence + 1;
    if nullif(v_input.id, '') is null then
      insert into public.payment_plan_instalments (order_id, quote_id, sequence, label, percentage, amount, due_on, internal_note, status)
      values (p_order_id, p_quote_id, v_sequence, trim(v_input.label), v_input.percentage, v_input.amount, v_input."dueOn", coalesce(trim(v_input."internalNote"), ''), 'draft')
      returning * into v_instalment;
    else
      select * into v_instalment from public.payment_plan_instalments
        where id = v_input.id::uuid and order_id = p_order_id for update;
      if not found then raise exception 'Payment plan instalment not found.'; end if;
      if v_instalment.status <> 'draft' then
        if v_instalment.sequence <> v_sequence
          or v_instalment.label is distinct from trim(v_input.label)
          or v_instalment.percentage is distinct from v_input.percentage
          or v_instalment.amount is distinct from v_input.amount
          or v_instalment.due_on is distinct from v_input."dueOn"
          or v_instalment.internal_note is distinct from coalesce(trim(v_input."internalNote"), '') then
          raise exception 'Issued or paid instalments cannot be changed.';
        end if;
        select * into v_invoice from public.invoices where payment_plan_instalment_id = v_instalment.id for update;
        if not found or v_invoice.status not in ('issued', 'paid') then raise exception 'Immutable instalment invoice is unavailable.'; end if;
        id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := v_invoice.status; return next;
        continue;
      end if;
      update public.payment_plan_instalments
      set quote_id = p_quote_id, sequence = v_sequence, label = trim(v_input.label), percentage = v_input.percentage, amount = v_input.amount, due_on = v_input."dueOn", internal_note = coalesce(trim(v_input."internalNote"), '')
      where id = v_instalment.id
      returning * into v_instalment;
    end if;
    v_invoice := public.sync_payment_plan_invoice_draft(p_order_id, v_order.order_number, v_order.customer_name, v_order.customer_email, v_order.customer_address, v_instalment.id, v_instalment.label, v_instalment.amount, v_instalment.due_on);
    id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'draft'; return next;
  end loop;
end;
$$;

create or replace function public.mark_payment_plan_invoice_paid(
  p_invoice_id uuid, p_paid_at timestamptz, p_internal_note text default ''
)
returns table (id uuid, invoice_number text, instalment_id uuid, status public.invoice_status, order_status public.order_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_instalment public.payment_plan_instalments;
  v_order_status public.order_status;
  v_note text := coalesce(nullif(trim(p_internal_note), ''), '');
begin
  perform public.assert_payment_plan_admin();
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or v_invoice.payment_plan_instalment_id is null then raise exception 'An issued payment-plan invoice is required.'; end if;
  select * into v_instalment from public.payment_plan_instalments where id = v_invoice.payment_plan_instalment_id and order_id = v_invoice.order_id for update;
  if not found then raise exception 'An issued payment-plan invoice is required.'; end if;
  if v_invoice.status = 'paid' and v_instalment.status = 'paid' then
    select status into v_order_status from public.orders where id = v_invoice.order_id;
    id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'paid'; order_status := v_order_status; return next; return;
  end if;
  if v_invoice.status <> 'issued' or v_instalment.status <> 'issued' then raise exception 'An issued payment-plan invoice is required.'; end if;

  update public.invoices set status = 'paid', paid_at = coalesce(p_paid_at, now()) where id = v_invoice.id;
  update public.payment_plan_instalments set status = 'paid', paid_at = coalesce(p_paid_at, now()) where id = v_instalment.id;

  if exists (
    select 1 from public.payment_plan_instalments p
    left join public.invoices i on i.payment_plan_instalment_id = p.id
    where p.order_id = v_invoice.order_id and (p.status <> 'paid' or i.status is distinct from 'paid')
  ) then
    v_order_status := 'invoiced';
    insert into public.order_status_events (order_id, status, note)
      values (v_invoice.order_id, 'invoiced', 'Invoice ' || v_invoice.invoice_number || ' marked paid.' || case when v_note = '' then '' else ' Payment note: ' || v_note end);
  else
    update public.orders set status = 'completed' where id = v_invoice.order_id;
    v_order_status := 'completed';
    insert into public.order_status_events (order_id, status, note)
      values (v_invoice.order_id, 'completed', 'Invoice ' || v_invoice.invoice_number || ' marked paid; all instalments received.' || case when v_note = '' then '' else ' Payment note: ' || v_note end);
  end if;
  id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'paid'; order_status := v_order_status; return next;
end;
$$;

revoke all on function public.mark_payment_plan_invoice_paid(uuid, timestamptz, text) from public;
grant execute on function public.mark_payment_plan_invoice_paid(uuid, timestamptz, text) to authenticated, service_role;