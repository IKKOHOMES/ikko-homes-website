-- Document-generation final-document lock and ownership-race regression.
-- Run after `supabase db reset` against a disposable database in TWO psql
-- sessions. Use an existing confirmed quote (or issued/paid invoice) for
-- `document_id`, its present order for `order_id`, and a second valid order for
-- `other_order_id` when exercising the ownership-race case.
--
-- \set order_id '...'
-- \set other_order_id '...'
-- \set document_type 'quote'       -- quote or invoice
-- \set document_id '...'
--
-- Safety invariant: both document generation and payment-plan lifecycle code
-- lock order, then schedule rows (id ASC), then the final document exclusively.
-- There is never a final-document FOR SHARE lock that must be upgraded.
--
-- A. Final-document lock contention (quote form shown; substitute invoices for
--    the invoice form). Session A locks the exact final document after holding
--    the common prefix, so Session B can only time out on an exclusive lock and
--    succeeds after A commits.
--
-- Session A
begin;
select 1 from public.orders where id = :'order_id'::uuid for update;
select 1 from public.payment_plan_instalments
where order_id = :'order_id'::uuid order by id for update;
select 1 from public.quotes
where id = :'document_id'::uuid and order_id = :'order_id'::uuid for update;
-- Keep this transaction open while Session B runs.

-- Session B (expected: ERROR: canceling statement due to lock timeout)
begin;
set local request.jwt.claim.role = 'service_role';
set local lock_timeout = '250ms';
select public.load_authorised_order_document(:'document_type', :'document_id'::uuid, null);
rollback;

-- Session A
commit;

-- Session B retry (expected: one authorised payload row)
begin;
set local request.jwt.claim.role = 'service_role';
select public.load_authorised_order_document(:'document_type', :'document_id'::uuid, null);
rollback;

-- B. Ownership/order race. This proves the final select is constrained to the
--    locked order rather than trusting its pre-lock document read.
--
-- Session A: lock the original order before Session B starts.
begin;
select 1 from public.orders where id = :'order_id'::uuid for update;

-- Session B: start this call; it reads the document, then blocks on Session A's
--    order lock.
begin;
set local request.jwt.claim.role = 'service_role';
select public.load_authorised_order_document(:'document_type', :'document_id'::uuid, null);
-- Expected after Session A commits: "Only confirmed quotes ..." for a quote,
-- or "Only issued or paid invoices ..." for an invoice. It must not return a
-- payload belonging to other_order_id.
rollback;

-- Session A: while B waits, move the final document to the different order,
-- then commit. Use only a disposable fixture; restore/rollback afterwards.
update public.quotes set order_id = :'other_order_id'::uuid
where :'document_type' = 'quote' and id = :'document_id'::uuid;
update public.invoices set order_id = :'other_order_id'::uuid
where :'document_type' = 'invoice' and id = :'document_id'::uuid;
commit;