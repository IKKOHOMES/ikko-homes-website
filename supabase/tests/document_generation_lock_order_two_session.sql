-- Deterministic document-generation final-lock and ownership-race regression.
-- Run after `supabase db reset` against a disposable database in TWO psql
-- sessions. The commands below are written for a confirmed quote. To exercise
-- the invoice path, replace `public.quotes` with `public.invoices` and require
-- `status in ('issued', 'paid')` wherever the quote status is checked.
--
-- \set order_id '...'        -- the quote's current order
-- \set other_order_id '...'  -- another disposable-fixture order
-- \set document_id '...'     -- a confirmed quote id
--
-- Production invariant: document generation takes exclusive locks in this
-- order: order, schedule rows (id ASC), final quote/invoice. There is never a
-- final-document FOR SHARE lock to upgrade.
--
-- A. Prove the final document—not the common prefix—is the contended lock.
--
-- Session A, stage 1: exercise and release the common prefix. This makes the
-- handoff explicit: B will not be blocked on order/schedule in stage 2.
begin;
select 1 from public.orders where id = :'order_id'::uuid for update;
select 1 from public.payment_plan_instalments
where order_id = :'order_id'::uuid order by id for update;
commit;

-- Session A, stage 2: hold ONLY the final quote row. Keep this transaction
-- open until Session B records its expected timeout.
begin;
select 1 from public.quotes
where id = :'document_id'::uuid
  and order_id = :'order_id'::uuid
  and status = 'confirmed'
for update;
-- Observation: this transaction has no order/schedule row locks.

-- Session B: the RPC can acquire order and schedule locks because stage 1 was
-- committed. Its 250ms timeout is therefore specifically the final quote row.
begin;
set local request.jwt.claim.role = 'service_role';
set local lock_timeout = '250ms';
select public.load_authorised_order_document('quote', :'document_id'::uuid, null);
-- Expected: ERROR: canceling statement due to lock timeout.
-- Do not retry until Session A commits.
rollback;

-- Session A
commit;

-- Session B: retry after the final row is released.
begin;
set local request.jwt.claim.role = 'service_role';
select public.load_authorised_order_document('quote', :'document_id'::uuid, null);
-- Expected: exactly one authorised payload row.
rollback;

-- B. Prove an order reassignment between the initial read and final document
-- lock fails closed. Session A's old-order lock forces B to finish its unlocked
-- pre-read before it can take the common prefix.
--
-- Session A
begin;
select pg_backend_pid() as a_pid \gset
select 1 from public.orders where id = :'order_id'::uuid for update;
-- Leave this transaction open.

-- Session B: first report this session's PID to A, then start the RPC. It will
-- block at the old-order FOR UPDATE after its initial no-lock document read.
select pg_backend_pid() as b_pid \gset
-- Copy :b_pid to Session A: \set b_pid '<value>'
begin;
set local request.jwt.claim.role = 'service_role';
select public.load_authorised_order_document('quote', :'document_id'::uuid, null);
-- This statement blocks until Session A commits; do not issue ROLLBACK yet.

-- Session A: wait for the explicit handshake observation before changing data.
-- It proves B is active and waiting on the common order lock, which comes after
-- the RPC's initial unlocked document/order/customer reads.
select state, wait_event_type, wait_event
from pg_stat_activity
where pid = :'b_pid'::integer;
-- Expected: state = active and wait_event_type = Lock.

-- Session A: move the quote while B is known to be blocked, then release the
-- old-order lock. This is a disposable-fixture mutation.
update public.quotes
set order_id = :'other_order_id'::uuid
where id = :'document_id'::uuid
  and order_id = :'order_id'::uuid;
commit;

-- Session B resumes, re-locks/re-authorizes the original order/customer, then
-- its final `FOR UPDATE` select is constrained to that locked order.
-- Expected: ERROR: Only confirmed quotes can be downloaded or emailed.
-- It must never return a payload for other_order_id. Clean up the aborted B
-- transaction, then reset/reseed the disposable fixture before another run.
rollback;