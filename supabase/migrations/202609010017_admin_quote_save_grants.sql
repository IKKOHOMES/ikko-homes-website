-- Quote editing is performed by authenticated administrator browser sessions.
-- Existing RLS policies continue to require public.is_admin() for every row.
grant select, insert, update, delete on public.quotes, public.quote_lines to authenticated;
grant insert on public.order_status_events to authenticated;