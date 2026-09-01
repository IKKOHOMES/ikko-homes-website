-- Customer checkout numbers are a simple four-digit monthly sequence:
-- ORD-YYYYMM0001.  Convert the temporary alphabetic rollout values once.

do $$
declare
  v_order record;
  v_suffix text;
  v_sequence integer;
begin
  for v_order in
    select id, order_number
    from public.orders
    where order_number ~ '^ORD-[0-9]{6}[A-Z]{4}$'
  loop
    v_suffix := right(v_order.order_number, 4);
    v_sequence :=
      (ascii(substr(v_suffix, 1, 1)) - 65) * 17576 +
      (ascii(substr(v_suffix, 2, 1)) - 65) * 676 +
      (ascii(substr(v_suffix, 3, 1)) - 65) * 26 +
      (ascii(substr(v_suffix, 4, 1)) - 65) + 1;
    if v_sequence > 9999 then
      raise exception 'Cannot convert order % to the four-digit ORD sequence.', v_order.order_number;
    end if;
    update public.orders
    set order_number = 'ORD-' || substring(v_order.order_number from '^ORD-([0-9]{6})') || lpad(v_sequence::text, 4, '0')
    where id = v_order.id;
  end loop;
end;
$$;

update public.order_document_number_counters
set last_sequence = last_sequence + 1;

alter table public.order_document_number_counters
  drop constraint if exists order_document_number_counters_last_sequence_check;
alter table public.order_document_number_counters
  add constraint order_document_number_counters_last_sequence_check
  check (last_sequence >= 1 and last_sequence <= 9999);

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
  values (p_period, 1)
  on conflict (period) do nothing
  returning last_sequence into v_sequence;

  if v_sequence is null then
    update public.order_document_number_counters
    set last_sequence = last_sequence + 1
    where period = p_period
      and last_sequence < 9999
    returning last_sequence into v_sequence;
  end if;

  if v_sequence is null then
    raise exception 'The order number capacity for % is exhausted.', p_period;
  end if;

  return 'ORD-' || p_period || lpad(v_sequence::text, 4, '0');
end;
$$;