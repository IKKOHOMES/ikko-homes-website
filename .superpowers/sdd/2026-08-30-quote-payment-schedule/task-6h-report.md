# Task 6H report — final DB release repairs

## Delivered

- Added forward migration `202608300012_final_db_release_repairs.sql`.
  - Enables RLS and removes anon/authenticated/public table access for quote counters and schedule snapshots; only `service_role` retains read access to snapshots.
  - Deletes migration-created snapshots/markers unless an issued/paid linked invoice or successfully sent quote document provides release evidence.
  - Captures release snapshots with prior immutable milestones plus only the target revision's draft rows, sorted by sequence.
  - Replaces document loading's share-lock/upgrade sequence with exclusive `orders -> payment_plan_instalments -> final quote/invoice` locks.
- Added `final_db_release_repairs.sql`, which builds legacy-state rows, reapplies the forward migration, and verifies cleanup, retention, revision scoping, RLS, and grants.
- Added a two-session document lock-order fixture.
- Strengthened lifecycle and auth/RLS fixtures; auth users now carry customer metadata and assert the production trigger created customer rows.

## Verification

- `git diff --check` — passed.
- `npm run build` — passed (existing Vite chunk-size and mixed import warnings only).
- `npm test` — blocked by existing local configuration: 39 UI tests fail with `Supabase is not configured.` The DB changes do not touch those paths.
- `npx supabase status` / `npx supabase db lint` — blocked because Docker/Podman and the local Postgres instance are unavailable on this host.
- The SQL fixtures were not run for the same local-database reason. Run after `supabase start`/`supabase db reset` with psql as documented at the top of each fixture.
## Review follow-up (2026-09-01)

- Auth/RLS fixtures now use `raw_user_meta_data` with `account_type: "customer"` and all `DO` blocks terminate with `$$;` before rollback, so customer-trigger failures surface before RLS assertions.
- The document RPC now re-locks the current order and customer after the common order lock, reruns ownership authorization, and constrains the final quote/invoice `FOR UPDATE` lookup to that locked order.
- `document_generation_lock_order_two_session.sql` now gives executable two-session commands for final-document exclusive-lock contention and the document-to-different-order race.

Verification: `git diff --check` and `npm run build` passed for the review follow-up.

## Final fixture handshake follow-up (2026-09-01)

- Reworked the two-session lock fixture so Part A releases the common order/schedule prefix before A holds only the final document row; B's timeout is therefore attributable to the final row, and the post-commit retry has an explicit success expectation.
- Part B now captures B's backend PID and requires A to observe B waiting on the old-order lock before reassignment. This proves B completed the unlocked pre-read before the final locked-order revalidation fails closed.
