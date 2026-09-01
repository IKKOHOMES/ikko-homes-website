-- Service-only administrator provisioning needs direct profile access. Browser users
-- remain constrained by the existing RLS policies.
grant select on public.profiles to service_role;

create or replace function public.set_profile_admin_role(p_profile_id uuid, p_is_admin boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Only the service role can change administrator roles';
  end if;

  insert into public.profiles (id, role)
  values (p_profile_id, case when p_is_admin then 'admin' else 'customer' end)
  on conflict (id) do update
    set role = excluded.role;
end;
$$;

revoke all on function public.set_profile_admin_role(uuid, boolean) from public;
grant execute on function public.set_profile_admin_role(uuid, boolean) to service_role;