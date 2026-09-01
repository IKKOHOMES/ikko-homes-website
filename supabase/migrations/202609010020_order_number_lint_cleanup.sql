-- Keep the customer order suffix allocator free of lint-only shadow warnings.
create or replace function public.order_number_alpha_suffix(p_sequence bigint)
returns text
language plpgsql
immutable
as $$
declare
  v_value bigint := p_sequence;
  v_suffix text := '';
begin
  if v_value is null or v_value < 0 or v_value >= 456976 then
    raise exception 'Order sequence must be between 0 and 456975.';
  end if;

  while length(v_suffix) < 4 loop
    v_suffix := chr(65 + (v_value % 26)::integer) || v_suffix;
    v_value := v_value / 26;
  end loop;
  return v_suffix;
end;
$$;