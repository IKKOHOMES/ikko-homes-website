-- Task 6I: issue new documents with the ORD/INV numbering convention while
-- retaining every previously persisted IKKO number.

alter table public.quotes
  add column if not exists quote_number_sequence bigint;

-- Keep the new ORD counter separate from the historical quote counter. This
-- guarantees the first new quote in each month is 0001 even when the legacy
-- counter already contains values from an earlier release.
create table if not exists public.quote_document_number_counters (
  period char(6) primary key,
  last_sequence bigint not null check (last_sequence > 0)
);
alter table public.quote_document_number_counters enable row level security;
revoke all on table public.quote_document_number_counters from public, anon, authenticated;

-- Record the numeric component of recognised historical values without
-- changing those values. It lets a newly created milestone invoice reference
-- an existing quote's sequence while issued invoice numbers remain immutable.
update public.quotes
set quote_number_sequence = case
  when quote_number ~ '^IKKO[0-9]{6}[0-9]+$'
    then substring(quote_number from '^IKKO[0-9]{6}([0-9]+)$')::bigint
  when quote_number ~ '^ORD-[0-9]{6}[0-9]+$'
    then substring(quote_number from '^ORD-[0-9]{6}([0-9]+)$')::bigint
  else null
end
where quote_number_sequence is null
  and quote_number is not null
  and (quote_number ~ '^IKKO[0-9]{6}[0-9]+$'
    or quote_number ~ '^ORD-[0-9]{6}[0-9]+$');

insert into public.quote_document_number_counters (period, last_sequence)
select substring(quote_number from '^ORD-([0-9]{6})[0-9]+$'),
       max(quote_number_sequence)
from public.quotes
where quote_number ~ '^ORD-[0-9]{6}[0-9]+$'
group by substring(quote_number from '^ORD-([0-9]{6})[0-9]+$')
on conflict (period) do update
  set last_sequence = greatest(
    public.quote_document_number_counters.last_sequence,
    excluded.last_sequence
  );

create or replace function public.excel_milestone_suffix(p_sequence integer)
returns text
language plpgsql
immutable
as $$
declare
  v_value integer := p_sequence;
  v_suffix text := '';
  v_remainder integer;
begin
  if v_value is null or v_value < 1 then
    raise exception 'Payment-plan sequence must be positive.';
  end if;
  while v_value > 0 loop
    v_remainder := (v_value - 1) % 26;
    v_suffix := chr(65 + v_remainder) || v_suffix;
    v_value := floor((v_value - 1) / 26);
  end loop;
  return v_suffix;
end;
$$;

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
  v_sequence bigint;
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

-- Revisions retain the source row and therefore the same visible quote number;
-- a caller-supplied number on a revision must not create a second number.
create or replace function public.link_quote_revision_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.version > 1 then
    select coalesce(q.quote_number_source_id, q.id)
      into new.quote_number_source_id
    from public.quotes q
    where q.order_id = new.order_id and q.id <> new.id
    order by q.version asc, q.created_at asc, q.id asc
    limit 1;
    new.quote_number := null;
    new.quote_number_sequence := null;
  end if;
  return new;
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

  v_number := coalesce(v_source.quote_number, v_quote.quote_number);
  v_sequence := coalesce(v_source.quote_number_sequence, v_quote.quote_number_sequence);
  if v_number like 'ORD-%' then
    v_period := substring(v_number from '^ORD-([0-9]{6})[0-9]+$');
    if v_sequence is null then
      v_sequence := substring(v_number from '^ORD-[0-9]{6}([0-9]+)$')::bigint;
    end if;
  elsif v_number like 'IKKO%' then
    v_period := substring(v_number from '^IKKO([0-9]{6})[0-9]+$');
    if v_sequence is null then
      v_sequence := substring(v_number from '^IKKO[0-9]{6}([0-9]+)$')::bigint;
    end if;
  end if;

  if v_period is not null and v_sequence is not null then
    return 'INV-' || v_period || lpad(v_sequence::text, 4, '0') || public.excel_milestone_suffix(v_instalment.sequence);
  end if;

  -- Arbitrary historical quote numbers have no safe numeric component. Keep
  -- the old allocator as a compatibility fallback rather than rewriting it.
  return public.reserve_invoice_number();
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
  v_invoice_number text;
  v_ex_gst numeric(12,2) := round(p_amount / 1.10, 2);
begin
  select * into v_invoice
  from public.invoices
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
    v_invoice_number := public.reserve_payment_plan_invoice_number(p_order_id, p_instalment_id);
    insert into public.invoices (
      invoice_number, order_id, customer_name, customer_email,
      customer_address, total, status, payment_plan_instalment_id, due_on
    )
    values (
      v_invoice_number, p_order_id, p_customer_name, p_customer_email,
      p_customer_address, p_amount, 'draft', p_instalment_id, p_due_on
    )
    returning * into v_invoice;
  end if;

  delete from public.invoice_lines where invoice_id = v_invoice.id;
  insert into public.invoice_lines (invoice_id, display_name, unit_price, quantity, finish)
  values (v_invoice.id, p_label || ' — ' || p_order_number, v_ex_gst, 1, null);
  return v_invoice;
end;
$$;

revoke all on function public.excel_milestone_suffix(integer) from public;
revoke all on function public.ensure_quote_number(uuid) from public;
revoke all on function public.reserve_payment_plan_invoice_number(uuid, uuid) from public;
revoke all on function public.sync_payment_plan_invoice_draft(uuid, text, text, text, text, uuid, text, numeric, date) from public;
grant execute on function public.ensure_quote_number(uuid) to authenticated, service_role;
grant execute on function public.reserve_payment_plan_invoice_number(uuid, uuid) to service_role;
grant execute on function public.sync_payment_plan_invoice_draft(uuid, text, text, text, text, uuid, text, numeric, date) to service_role;
