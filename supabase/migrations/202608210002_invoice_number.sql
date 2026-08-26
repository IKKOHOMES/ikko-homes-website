create or replace function public.reserve_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_prefix text;
  reserved_number bigint;
begin
  update public.invoice_sequences
  set next_number = next_number + 1
  where id = true
  returning prefix, next_number - 1 into sequence_prefix, reserved_number;

  if reserved_number is null then
    raise exception 'Invoice sequence is unavailable';
  end if;

  return sequence_prefix || reserved_number::text;
end;
$$;

revoke all on function public.reserve_invoice_number() from public;
grant execute on function public.reserve_invoice_number() to service_role;
