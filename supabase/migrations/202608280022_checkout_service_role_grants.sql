-- The create-order Edge Function runs with the service role and needs these
-- server-side privileges to verify products and persist an order atomically.
grant select on public.products, public.cabinetry_products to service_role;

grant select, insert, update on public.customers to service_role;
grant select, insert, update, delete on public.orders to service_role;
grant select, insert on public.order_lines to service_role;
grant insert on public.order_status_events to service_role;
grant insert on public.cabinetry_drawings to service_role;
grant select, insert on public.invoices to service_role;
grant insert on public.invoice_lines to service_role;
