-- Payment-plan lifecycle lock-order regression.
--
-- Run this file in TWO psql sessions against a disposable database after applying
-- migrations. It is deliberately a manual multi-session test: a one-connection
-- SQL harness cannot prove that lock acquisition blocks rather than deadlocks.
-- Substitute a real order, a draft invoice on that order, and (for mark-paid) an
-- issued invoice on the same order before running.
--
-- Contract enforced by migration 202608300007:
--   lock_payment_plan_order: orders -> all payment_plan_instalments (id ASC)
--   issue/sync/replace/mark-paid: lock_payment_plan_order -> invoice
--   mark-paid then locks its linked instalment after the invoice.
-- No lifecycle RPC may acquire an invoice before the order schedule.

-- SESSION A: hold the common prefix. Keep this transaction open.
begin;
select 1
from public.orders
where id = :'order_id'::uuid
for update;
select 1
from public.payment_plan_instalments
where order_id = :'order_id'::uuid
order by id
for update;

-- SESSION B: run ONE of the following while Session A is open. Each must fail
-- with SQLSTATE 55P03 (lock timeout), demonstrating that it waits at the common
-- order/schedule prefix before it can lock an invoice. Repeat for every RPC.
begin;
set local lock_timeout = '2s';
-- select * from public.issue_payment_plan_invoice(:'order_id'::uuid, :'draft_invoice_id'::uuid);
-- select * from public.synchronise_payment_plan_invoices(:'order_id'::uuid);
-- select * from public.replace_payment_plan_and_sync_invoices(:'order_id'::uuid, :'quote_id'::uuid, '[]'::jsonb);
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