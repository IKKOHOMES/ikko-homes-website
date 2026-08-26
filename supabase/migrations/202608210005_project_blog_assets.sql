insert into storage.buckets (id, name, public) values
  ('project-assets', 'project-assets', true),
  ('blog-assets', 'blog-assets', true)
on conflict (id) do nothing;

create policy "public reads project assets" on storage.objects for select to anon, authenticated
using (bucket_id = 'project-assets');

create policy "admins manage project assets" on storage.objects for all to authenticated
using (bucket_id = 'project-assets' and public.is_admin())
with check (bucket_id = 'project-assets' and public.is_admin());

create policy "public reads blog assets" on storage.objects for select to anon, authenticated
using (bucket_id = 'blog-assets');

create policy "admins manage blog assets" on storage.objects for all to authenticated
using (bucket_id = 'blog-assets' and public.is_admin())
with check (bucket_id = 'blog-assets' and public.is_admin());
