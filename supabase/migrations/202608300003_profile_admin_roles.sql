alter table public.profiles
  add column if not exists role text not null default 'customer'
  check (role in ('admin', 'customer'));

update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin';

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;