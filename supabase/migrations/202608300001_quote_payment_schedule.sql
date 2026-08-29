create table public.quote_number_counters (
  period char(6) primary key,
  last_sequence integer not null
);

alter table public.quotes
  add column quote_number text unique,
  add column subtotal numeric(12,2),
  add column discount_total numeric(12,2) default 0,
  add column gst_total numeric(12,2) default 0;

alter table public.payment_plan_instalments
  add column percentage numeric(7,4);

alter type public.invoice_status add value if not exists 'draft';

create or replace function public.ensure_quote_number(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_number text;
  v_period char(6);
  v_sequence integer;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only administrators can assign quote numbers';
  end if;

  select quote_number, to_char(created_at, 'YYYYMM')
    into v_quote_number, v_period
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote % does not exist', p_quote_id;
  end if;

  if v_quote_number is not null then
    return v_quote_number;
  end if;

  insert into public.quote_number_counters (period, last_sequence)
  values (v_period, 1)
  on conflict (period) do update
    set last_sequence = public.quote_number_counters.last_sequence + 1
  returning last_sequence into v_sequence;

  update public.quotes
  set quote_number = 'IKKO' || v_period || lpad(v_sequence::text, 4, '0')
  where id = p_quote_id
    and quote_number is null
  returning quote_number into v_quote_number;

  return v_quote_number;
end;
$$;

revoke all on function public.ensure_quote_number(uuid) from public;
grant execute on function public.ensure_quote_number(uuid) to authenticated, service_role;