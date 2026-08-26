-- Permit the browser-based internal admin to manage the catalogue and editorial
-- records that are synchronised from the existing storefront.
grant select, insert, update, delete on public.product_categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_finishes to authenticated;
grant select, insert, update, delete on public.product_images to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_images to authenticated;
grant select, insert, update, delete on public.blog_posts to authenticated;
grant select, insert, update, delete on public.blog_social_links to authenticated;

-- The public storefront reads only records already constrained by RLS policies.
grant select on public.product_categories to anon;
grant select on public.products to anon;
grant select on public.product_finishes to anon;
grant select on public.product_images to anon;
grant select on public.projects to anon;
grant select on public.project_images to anon;
grant select on public.blog_posts to anon;
grant select on public.blog_social_links to anon;
