# Task 6B — Lifecycle Remediation Report

## Implemented

- Added `202608300006_quote_lifecycle_revision_integrity.sql`.
  - Quote revisions use `quotes.quote_number_source_id`. `ensure_quote_number` returns the original source number, while the migration deterministically chooses each order's earliest quote as source, moves a legacy number there when necessary, clears revision duplicates before the move, and links later revisions.
  - Submitted payment-plan IDs are canonicalized as UUIDs for duplicate, membership, deletion, and update comparisons. Mixed-case duplicate UUID variants are rejected.
  - Issued, overdue, and paid instalments are immutable; draft rows can still be edited, deleted, inserted, and relinked to a newer confirmed quote revision. Issued/paid rows retain their original quote link and invoice.
  - `mark_payment_plan_invoice_paid` treats overdue strictly as an instalment status. The linked invoice remains `issued`, and can transition to paid.
- Added forward migration `202608300007_payment_plan_lock_order.sql`.
  - Introduces internal `lock_payment_plan_order`, which always locks `orders`, then every payment-plan instalment in ascending UUID order.
  - Replaces every lifecycle RPC that can touch a plan: `sync_payment_plan_invoice_draft`, `synchronise_payment_plan_invoices`, `replace_payment_plan_and_sync_invoices`, `issue_payment_plan_invoice`, and `mark_payment_plan_invoice_paid`.
  - Each RPC takes the common prefix before locking a linked invoice and re-selects mutable rows after that prefix. This removes invoice-first paths that could deadlock against schedule replacement or a simultaneous final payment.
  - The helper is revoked from `public`; existing RPC grants and administrator checks remain intact.
- Updated the admin client to call the paid-lifecycle RPC instead of separate writes, preserve quote-number linkage when creating a revision, display the inherited quote number, and disable all editing/removal/reordering actions for issued, overdue, and paid schedule rows.
- Quote PDFs load the order schedule as of the requested revision: current-revision rows plus immutable milestones from that revision or earlier. A v1 PDF therefore excludes a later v2 draft, while invoice documents remain based on their immutable invoice/instalment snapshot.

## Tests added or updated

- `supabase/tests/quote_lifecycle_rpc.sql` is rollback-only local SQL/RPC coverage for:
  - mixed paid/draft plans staying invoiced,
  - all-paid plans completing, including an overdue instalment with an issued invoice,
  - immutable v1 milestones plus mutable v2 draft changes,
  - legacy and new revision quote-number source normalization,
  - duplicate nonblank submitted IDs, including mixed-case UUID variants.
- `supabase/tests/payment_plan_lock_order_two_session.sql` documents an executable two-psql-session lock-timeout regression. It requires a fresh RPC-specific disposable fixture, explicit psql variables, and `SET LOCAL request.jwt.claim.role = 'service_role'` in each test transaction so each RPC passes the same production guard before contending on the common prefix. It uses a nonempty, total-matching replacement payload and includes deterministic catalogue/privilege checks. It intentionally does not claim that a single SQL session proves concurrency.
- `supabase/functions/order-document/quote-revision-schedule.test.ts` covers v1/v2 schedule selection and inherited IKKO quote numbers.
- `src/test/payment-plan-editor.test.tsx` verifies immutable schedule controls are disabled while drafts remain editable.
- `src/test/quote-editor.test.tsx` verifies the inherited IKKO number is displayed.

## Verification

- Focused Vitest passed: 7 tests (`payment-plan-editor`, `quote-editor`, `admin-payment-plan-save`).
- `npm run build` passed. Existing Vite dynamic-import/chunk-size warnings remain.
- `git diff --check` is run before commit.

## Environment limitations

- Local SQL/RPC execution is unavailable: `npx supabase status` reports Docker and Podman are not installed/on `PATH`. The two-session SQL test is included for a disposable database with two psql sessions.
- Deno is unavailable on `PATH`, so the order-document Deno test could not be executed in this worktree.
- No deployment, push, or main-worktree edit was performed.