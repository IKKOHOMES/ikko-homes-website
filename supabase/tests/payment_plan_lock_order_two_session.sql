-- Payment-plan lifecycle lock-order regression.
--
-- Run this test in TWO psql sessions against a disposable database after applying
-- migrations. It deliberately uses two transactions: a one-connection SQL harness
-- cannot prove that lock acquisition blocks rather than deadlocks.
--
-- Run each RPC with a fresh disposable fixture. For issue, synchronise, and
-- replace, use a quoted order with a confirmed fully priced quote, a matching
-- draft-only plan, and a draft invoice. For mark-paid, use an issued plan invoice
-- on its own fixture. In both psql sessions set the variables needed by that RPC:
--   \set order_id '...'
--   \set quote_id '...'
--   \set quote_total '...'
--   \set draft_instalment_id '...'
--   \set draft_invoice_id '...'
--   \set issued_invoice_id '...'
-- Both sessions set the same service-role custom GUC read by the production RPC
-- authorization guard. This is test-session setup only; it does not change
-- production grants or authorization.
--
-- Contract enforced by migration 202608300007:
--   lock_payment_plan_order: orders -> all payment_plan_instalments (id ASC)
--   issue/sync/replace/mark-paid: lock_payment_plan_order -> invoice
--   mark-paid then re-selects its linked instalment after the invoice.
-- No lifecycle RPC may acquire an invoice before the order schedule.

-- SESSION A: hold the common prefix. Keep this transaction open.
begin;
set local request.jwt.claim.role = 'service_role';
select 1
from public.orders
where id = :'order_id'::uuid
for update;
select 1
from public.payment_plan_instalments
where order_id = :'order_id'::uuid
order by id
for update;

-- SESSION B: run ONE of the following while Session A is open. Each call first
-- passes the production authorization guard, then must fail with SQLSTATE 55P03
-- (lock timeout). Before the shared helper there are no row locks in these RPCs;
-- this timeout therefore proves it reached the common order/schedule prefix.
-- Repeat with a fresh disposable fixture for every RPC.
begin;
set local request.jwt.claim.role = 'service_role';
set local lock_timeout = '2s';
-- select * from public.issue_payment_plan_invoice(:'order_id'::uuid, :'draft_invoice_id'::uuid);
-- select * from public.synchronise_payment_plan_invoices(:'order_id'::uuid);
-- select * from public.replace_payment_plan_and_sync_invoices(
--   :'order_id'::uuid,
--   :'quote_id'::uuid,
--   jsonb_build_array(jsonb_build_object(
--     'id', :'draft_instalment_id'::uuid,
--     'label', 'Lock-order test',
--     'percentage', 100,
--     'amount', :'quote_total'::numeric,
--     'dueOn', current_date,
--     'internalNote', ''
--   ))
-- );
-- select * from public.mark_payment_plan_invoice_paid(:'issued_invoice_id'::uuid, now(), 'Two-session lock-order test');
rollback;

-- SESSION A: release locks after Session B has observed the timeout.
rollback;

-- Deterministic catalogue contract. The functions below must exist and the
-- central lock helper is intentionally not executable by public callers.
do $$
begin
  if to_regprocedure('public.lock_payment_plan_order(uuid)') is null
     or to_regprocedure('public.issue_payment_plan_invoice(uuid,uuid)') is null
     or to_regprocedure('public.synchronise_payment_plan_invoices(uuid)') is null
     or to_regprocedure('public.replace_payment_plan_and_sync_invoices(uuid,uuid,jsonb)') is null
     or to_regprocedure('public.mark_payment_plan_invoice_paid(uuid,timestamp with time zone,text)') is null then
    raise exception 'Expected common payment-plan lock-order RPCs are missing';
  end if;

  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
    where p.oid = 'public.lock_payment_plan_order(uuid)'::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception 'Internal payment-plan lock helper must not be publicly executable';
  end if;
end;
$$;