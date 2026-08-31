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