-- Document-generation lock-order regression.
-- Run after `supabase db reset` against a disposable database in TWO psql sessions.
-- Supply a confirmed quote/invoice fixture and set the variables below in both
-- sessions. This checks the real lock boundary: document generation waits behind
-- the common exclusive order/schedule prefix, then succeeds after it releases.
--
-- \set order_id '...'
-- \set document_type 'quote'       -- or invoice
-- \set document_id '...'
-- \set studio_abn ''
--
-- Session A: hold the common prefix open.
begin;
select 1 from public.orders where id = :'order_id'::uuid for update;
select 1 from public.payment_plan_instalments
where order_id = :'order_id'::uuid
order by id
for update;

-- Session B: while Session A is open, this must wait and hit lock_timeout
-- rather than acquiring a FOR SHARE lock that later deadlocks on an update.
begin;
set local request.jwt.claim.role = 'service_role';
set local lock_timeout = '250ms';
select public.load_authorised_order_document(:'document_type', :'document_id'::uuid, nullif(:'studio_abn', ''));
-- Expected: ERROR: canceling statement due to lock timeout
rollback;

-- Commit Session A, then rerun the Session B select with no lock_timeout. It
-- must succeed and return the same authorised document payload.
commit;