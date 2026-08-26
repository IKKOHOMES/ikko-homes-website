insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

create policy "public reads product assets" on storage.objects for select to anon, authenticated
using (bucket_id = 'product-assets');

create policy "admins manage product assets" on storage.objects for all to authenticated
using (bucket_id = 'product-assets' and public.is_admin())
with check (bucket_id = 'product-assets' and public.is_admin());
