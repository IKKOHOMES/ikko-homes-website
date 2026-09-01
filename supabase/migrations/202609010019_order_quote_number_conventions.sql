-- Customer orders, confirmed quotes, and payment invoices have distinct,
-- human-readable number spaces.  Allocation occurs in PostgreSQL so concurrent
-- Edge Function invocations cannot return the same customer order number.

create table if not exists public.order_document_number_counters (
  period char(6) primary key,
  last_sequence bigint not null check (last_sequence >= 0 and last_sequence < 456976)
);
alter table public.order_document_number_counters enable row level security;
revoke all on table public.order_document_number_counters from public, anon, authenticated;

create or replace function public.order_number_alpha_suffix(p_sequence bigint)
returns text
language plpgsql
immutable
as $$
declare
  v_value bigint := p_sequence;
  v_suffix text := '';
  v_index integer;
begin
  if v_value is null or v_value < 0 or v_value >= 456976 then
    raise exception 'Order sequence must be between 0 and 456975.';
  end if;

  for v_index in 1..4 loop
    v_suffix := chr(65 + (v_value % 26)::integer) || v_suffix;
    v_value := v_value / 26;
  end loop;
  return v_suffix;
end;
$$;

create or replace function public.reserve_order_number_for_period(p_period char(6))
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence bigint;
begin
  if p_period is null or p_period !~ '^[0-9]{6}$' then
    raise exception 'Order number period is invalid.';
  end if;

  insert into public.order_document_number_counters (period, last_sequence)
  values (p_period, 0)
  on conflict (period) do nothing
  returning last_sequence into v_sequence;

  if v_sequence is null then
    update public.order_document_number_counters
    set last_sequence = last_sequence + 1
    where period = p_period
      and last_sequence < 456975
    returning last_sequence into v_sequence;
  end if;

  if v_sequence is null then
    raise exception 'The order number capacity for % is exhausted.', p_period;
  end if;

  return 'ORD-' || p_period || public.order_number_alpha_suffix(v_sequence);
end;
$$;

create or replace function public.reserve_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.reserve_order_number_for_period(
    to_char(timezone('Australia/Sydney', clock_timestamp()), 'YYYYMM')::char(6)
  );
end;
$$;

-- Test orders used an eight-character UUID fragment.  The user has asked for
-- all current records to follow the new audit-friendly ORD format, so convert
-- those legacy values once in creation order without reusing a sequence.
do $$
declare
  v_order record;
  v_period char(6);
begin
  for v_order in
    select id, created_at
    from public.orders
    where order_number ~ '^ORD-[A-F0-9]{8}$'
    order by created_at, id
  loop
    v_period := to_char(timezone('Australia/Sydney', v_order.created_at), 'YYYYMM')::char(6);
    update public.orders
    set order_number = public.reserve_order_number_for_period(v_period)
    where id = v_order.id;
  end loop;
end;
$$;

-- Formal quotes previously used an ORD prefix.  Preserve their period and
-- sequence, while making their document type unambiguous.  Existing invoice
-- roots remain unchanged because they use the same stored sequence.
update public.quotes
set quote_number = 'QTE-' || substring(quote_number from '^ORD-([0-9]{6}[0-9]+)$')
where quote_number ~ '^ORD-[0-9]{6}[0-9]+$';

insert into public.quote_document_number_counters (period, last_sequence)
select substring(quote_number from '^QTE-([0-9]{6})[0-9]+$'),
       max(coalesce(quote_number_sequence, substring(quote_number from '^QTE-[0-9]{6}([0-9]+)$')::bigint))
from public.quotes
where quote_number ~ '^QTE-[0-9]{6}[0-9]+$'
group by substring(quote_number from '^QTE-([0-9]{6})[0-9]+$')
on conflict (period) do update
  set last_sequence = greatest(
    public.quote_document_number_counters.last_sequence,
    excluded.last_sequence
  );

create or replace function public.ensure_quote_number(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_source public.quotes;
  v_order_id uuid;
  v_period char(6);
  v_sequence bigint;
  v_invoice_root text;
  v_quote_number text;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only administrators can assign quote numbers';
  end if;

  select order_id into v_order_id from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote % does not exist', p_quote_id; end if;

  perform 1 from public.orders where id = v_order_id for update;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote % does not exist', p_quote_id; end if;
  if v_quote.status <> 'confirmed' then
    raise exception 'Only confirmed quotes can receive a quote number.';
  end if;
  if v_quote.quote_number is not null then return v_quote.quote_number; end if;

  select * into v_source
  from public.quotes
  where id = coalesce(v_quote.quote_number_source_id, v_quote.id)
  for update;
  if not found or v_source.order_id <> v_quote.order_id or v_source.status <> 'confirmed' then
    raise exception 'A confirmed quote number source is required.';
  end if;
  if v_source.quote_number is not null then return v_source.quote_number; end if;

  v_period := to_char(timezone('Australia/Sydney', clock_timestamp()), 'YYYYMM')::char(6);
  loop
    insert into public.quote_document_number_counters (period, last_sequence)
    values (v_period, 1)
    on conflict (period) do update
      set last_sequence = public.quote_document_number_counters.last_sequence + 1
    returning last_sequence into v_sequence;

    v_invoice_root := 'INV-' || v_period || lpad(v_sequence::text, 4, '0');
    v_quote_number := 'QTE-' || v_period || lpad(v_sequence::text, 4, '0');
    exit when not exists (
      select 1 from public.invoice_number_reservations r
      where r.invoice_number ~ ('^' || v_invoice_root || '[A-Z]+$')
    ) and not exists (
      select 1 from public.invoices i
      where i.invoice_number ~ ('^' || v_invoice_root || '[A-Z]+$')
    ) and not exists (
      select 1 from public.quotes q where q.quote_number = v_quote_number
    );
  end loop;

  update public.quotes
  set quote_number_sequence = v_sequence,
      quote_number = v_quote_number
  where id = v_source.id
    and quote_number is null
  returning quote_number into v_source.quote_number;
  return v_source.quote_number;
end;
$$;

create or replace function public.reserve_payment_plan_invoice_number(
  p_order_id uuid,
  p_instalment_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instalment public.payment_plan_instalments;
  v_quote public.quotes;
  v_source public.quotes;
  v_quote_number text;
  v_period text;
  v_sequence bigint;
  v_number text;
  v_rows integer;
begin
  select * into v_instalment
  from public.payment_plan_instalments
  where id = p_instalment_id and order_id = p_order_id;
  if not found then raise exception 'Payment-plan instalment is unavailable.'; end if;

  select * into v_quote from public.quotes where id = v_instalment.quote_id;
  if not found then raise exception 'Quote is unavailable.'; end if;
  select * into v_source
  from public.quotes
  where id = coalesce(v_quote.quote_number_source_id, v_quote.id);
  if not found then raise exception 'Quote number source is unavailable.'; end if;

  v_quote_number := coalesce(v_source.quote_number, v_quote.quote_number);
  if v_quote_number ~ '^QTE-[0-9]{6}[0-9]+$' then
    v_period := substring(v_quote_number from '^QTE-([0-9]{6})[0-9]+$');
    v_sequence := coalesce(v_source.quote_number_sequence, v_quote.quote_number_sequence);
    if v_sequence is null then
      v_sequence := substring(v_quote_number from '^QTE-[0-9]{6}([0-9]+)$')::bigint;
    end if;
    v_number := 'INV-' || v_period || lpad(v_sequence::text, 4, '0') || public.excel_milestone_suffix(v_instalment.sequence);

    if exists (select 1 from public.invoices where invoice_number = v_number)
      or exists (select 1 from public.invoice_number_reservations where invoice_number = v_number) then
      raise exception 'Quote invoice root is already reserved.';
    end if;

    insert into public.invoice_number_reservations (invoice_number)
    values (v_number)
    on conflict (invoice_number) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Quote invoice root is already reserved.';
    end if;
    return v_number;
  end if;

  return public.reserve_legacy_invoice_number();
end;
$$;

revoke all on function public.order_number_alpha_suffix(bigint) from public;
revoke all on function public.reserve_order_number_for_period(char) from public;
revoke all on function public.reserve_order_number() from public;
revoke all on function public.ensure_quote_number(uuid) from public;
revoke all on function public.reserve_payment_plan_invoice_number(uuid, uuid) from public;
grant execute on function public.reserve_order_number() to service_role;
grant execute on function public.ensure_quote_number(uuid) to authenticated, service_role;
grant execute on function public.reserve_payment_plan_invoice_number(uuid, uuid) to service_role;