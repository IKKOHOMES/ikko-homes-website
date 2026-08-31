# Task 6E — Final Integrity Report

## Implemented

- Added forward migration `202608300010_final_release_integrity.sql`.
  - Customer invoice and invoice-line RLS now requires both customer ownership and `issued`/`paid` lifecycle status.
  - Removed pre-frozen schedule snapshots unless independently supported by a sent quote delivery or an issued/paid linked invoice. Draft/released schedules are still captured only at the authorised document-release boundary.
  - Quote confirmation recalculates GST-exclusive subtotal, discount, 10% GST, and GST-inclusive total from quote lines, and allocates the quote number while it already holds the lifecycle locks.
  - Quote-number allocation locks order before quote; document loads lock order, then schedule, then quote/invoice, avoiding document quote/invoice-first locking and quote-number lock upgrades during customer downloads.
  - Draft invoice lines are written GST-exclusive; invoice document subtotal is the rounded invoice-line sum and GST is the remaining amount to the inclusive invoice total.
  - Schedule validation accepts the same two-decimal canonical percentages and ±0.01% total tolerance used by the client. Draft sequence changes first move to unique temporary positive sequences, then their submitted order, preserving immutable milestones.
  - The authorised document RPC now accepts `p_studio_abn`; the Edge Function forwards optional `IKKO_HOMES_ABN` without forwarding caller identity or admin claims.
- Payment-plan editor balancing now targets the last editable draft row rather than a final issued/paid/overdue milestone.
- Added regression coverage for immutable-final-row balancing and configured ABN RPC payload forwarding.
- Repaired the executable document authorisation fixture to use an already allocated quote number for the own-customer check; it no longer relies on customer-side quote-number allocation.

## Commands and results

- `npm test -- src/test/payment-plan-editor.test.tsx` — RED observed for final immutable-row mutation, then PASS (6 tests).
- `npm test -- src/test/payment-plan-editor.test.tsx src/test/admin-payment-plan-save.test.ts` — PASS (8 tests).
- `npm run build` — PASS. Existing Vite dynamic-import/chunk-size warnings remain.
- `git diff --check` — PASS.
- `deno test --allow-env --allow-net ...` — not run: `deno` is not available on PATH in this environment.
- `npx supabase db lint` — blocked: local Postgres at `127.0.0.1:54322` refused the connection (Docker/Supabase local stack is not running).

## Remaining external gaps

- Apply the forward migration to a disposable/local Supabase database and run `supabase/tests/document_authorisation_rpc_integration.sql` plus `supabase/tests/quote_lifecycle_rpc.sql`; local Postgres was unavailable here.
- Run Deno Edge-function tests in an environment with Deno installed.
- No deployment, push, or main-worktree edits were performed.