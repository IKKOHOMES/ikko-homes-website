-- Tables created through the migration API need explicit privileges in addition
-- to their row-level-security policies before PostgREST can serve them.
grant select on public.home_page_content to anon;
grant select, insert, update, delete on public.home_page_content to authenticated;

grant select on public.home_service_pillars to anon;
grant select, insert, update, delete on public.home_service_pillars to authenticated;

grant select on public.style_ranges to anon;
grant select, insert, update, delete on public.style_ranges to authenticated;
