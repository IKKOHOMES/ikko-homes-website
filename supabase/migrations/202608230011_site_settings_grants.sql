-- The administrator dashboard reads and updates the singleton studio settings row.
-- RLS remains the authorisation boundary through the existing is_admin() policy.
grant select, update on public.site_settings to authenticated;
