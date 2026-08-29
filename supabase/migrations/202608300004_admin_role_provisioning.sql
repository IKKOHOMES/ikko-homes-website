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

  update public.profiles
  set role = case when p_is_admin then 'admin' else 'customer' end
  where id = p_profile_id;

  if not found then
    raise exception 'Profile % does not exist', p_profile_id;
  end if;
end;
$$;

revoke all on function public.set_profile_admin_role(uuid, boolean) from public;
grant execute on function public.set_profile_admin_role(uuid, boolean) to service_role;
comment on function public.set_profile_admin_role(uuid, boolean) is
  'Server-only admin provisioning. Invoke with the configured service-role key; never from browser clients.';