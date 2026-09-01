-- Customer CRM actions run in authenticated administrator browser sessions.
-- Existing RLS policies still require public.is_admin() for every row.
grant select, update on public.customers to authenticated;
grant select, insert on public.customer_notes to authenticated;