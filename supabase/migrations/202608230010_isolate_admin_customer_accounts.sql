-- Keep internal administrator accounts out of the customer CRM lifecycle.
create or replace function public.create_customer_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  customer_email text := lower(coalesce(new.email, ''));
  customer_first_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 'Customer');
  customer_last_name text := coalesce(trim(new.raw_user_meta_data ->> 'last_name'), '');
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') <> 'customer' then
    return new;
  end if;

  if customer_email = '' then
    return new;
  end if;

  update public.customers
  set auth_user_id = new.id
  where lower(email) = customer_email and auth_user_id is null;

  if not found then
    insert into public.customers (first_name, last_name, email, phone, address, auth_user_id)
    values (customer_first_name, customer_last_name, customer_email, '', '', new.id)
    on conflict ((lower(email))) do update
      set auth_user_id = excluded.auth_user_id
      where public.customers.auth_user_id is null;
  end if;

  return new;
end;
$$;

create policy "profiles read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

grant select on public.profiles to authenticated;
