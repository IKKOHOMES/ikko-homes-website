-- Task 6I follow-up: keep legacy issued numbers immutable while preventing an
-- historical INV-shaped value from colliding with a new ORD invoice.

create table if not exists public.invoice_number_reservations (
  invoice_number text primary key,
  reserved_at timestamptz not null default now()
);
alter table public.invoice_number_reservations enable row level security;
revoke all on table public.invoice_number_reservations from public, anon, authenticated;

-- Existing invoices, including historical issued IKKO values, are immutable;
-- seed the reservation ledger without changing any of them.
insert into public.invoice_number_reservations (invoice_number)
select invoice_number from public.invoices
on conflict (invoice_number) do nothing;

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
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only administrators can assign quote numbers';
  end if;

  -- Keep the shared lifecycle lock order: order, quote, then counter.
  select order_id into v_order_id
  from public.quotes
  where id = p_quote_id;
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

  v_period := to_char(v_source.created_at, 'YYYYMM');
  insert into public.quote_document_number_counters (period, last_sequence)
  values (v_period, 1)
  on conflict (period) do update
    set last_sequence = public.quote_document_number_counters.last_sequence + 1
  returning last_sequence into v_sequence;

  update public.quotes
  set quote_number_sequence = v_sequence,
      quote_number = 'ORD-' || v_period || lpad(v_sequence::text, 4, '0')
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

  -- Only the new ORD namespace emits INV-YYYYMMNNNNA/B/C. Historical IKKO
  -- quotes continue through the legacy allocator and are never rewritten.
  if coalesce(v_source.quote_number, v_quote.quote_number) like 'ORD-%' then
    v_period := substring(coalesce(v_source.quote_number, v_quote.quote_number) from '^ORD-([0-9]{6})[0-9]+$');
    v_sequence := coalesce(v_source.quote_number_sequence, v_quote.quote_number_sequence);
    if v_sequence is null then
      v_sequence := substring(coalesce(v_source.quote_number, v_quote.quote_number) from '^ORD-[0-9]{6}([0-9]+)$')::bigint;
    end if;
  end if;

  if v_period is not null and v_sequence is not null then
    loop
      v_number := 'INV-' || v_period || lpad(v_sequence::text, 4, '0') || public.excel_milestone_suffix(v_instalment.sequence);
      insert into public.invoice_number_reservations (invoice_number)
      values (v_number)
      on conflict (invoice_number) do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 1 and not exists (select 1 from public.invoices where invoice_number = v_number) then
        return v_number;
      end if;
      v_sequence := v_sequence + 1;
    end loop;
  end if;

  return public.reserve_legacy_invoice_number();
end;
$$;

create or replace function public.reserve_legacy_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_rows integer;
begin
  loop
    v_number := public.reserve_invoice_number();
    insert into public.invoice_number_reservations (invoice_number)
    values (v_number)
    on conflict (invoice_number) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 and not exists (select 1 from public.invoices where invoice_number = v_number) then
      return v_number;
    end if;
  end loop;
end;
$$;

revoke all on function public.ensure_quote_number(uuid) from public;
revoke all on function public.reserve_payment_plan_invoice_number(uuid, uuid) from public;
revoke all on function public.reserve_legacy_invoice_number() from public;
grant execute on function public.ensure_quote_number(uuid) to authenticated, service_role;
grant execute on function public.reserve_payment_plan_invoice_number(uuid, uuid) to service_role;
grant execute on function public.reserve_legacy_invoice_number() to service_role;
