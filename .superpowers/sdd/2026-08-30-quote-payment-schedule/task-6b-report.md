# Task 6B — Lifecycle Remediation Report

## Implemented

- Added migration `202608300006_quote_lifecycle_revision_integrity.sql`.
  - `mark_payment_plan_invoice_paid` locks the invoice and its instalment, moves both to paid, writes the status event, and evaluates every plan instalment and linked invoice before completing the order. Draft, issued, overdue, missing-invoice, and unpaid rows therefore prevent `completed`.
  - `replace_payment_plan_and_sync_invoices` now locks the complete schedule and permits edits to draft rows after an invoice is issued. Issued/paid rows must remain in the submitted schedule, remain byte-for-value immutable (including sequence), retain their original quote link and existing invoice, while draft rows may be edited, deleted, inserted, and relinked to the current confirmed revision.
  - Quote revisions use `quotes.quote_number_source_id`; `ensure_quote_number` allocates/returns the number of the source quote, avoiding a duplicate unique quote number. A trigger fills this linkage for revision inserts made outside the client.
- Updated the admin client to invoke the paid-lifecycle RPC (instead of separate non-atomic writes), preserve quote-number linkage when creating a revision, resolve/display the inherited number, and lock issued/paid schedule controls in the editor.
- Quote PDFs now load the payment schedule by order rather than only the current quote foreign key. This preserves immutable prior-revision invoice snapshots while making the latest revision PDF usable.

## Tests added/updated

- `supabase/tests/quote_lifecycle_rpc.sql` is a rollback-only local SQL/RPC integration test for:
  - mixed paid/draft plan does not complete,
  - all paid plan completes,
  - issued row remains linked to v1 while a draft row is edited/relinked to v2,
  - quote revision returns the original IKKO number.
- `supabase/functions/order-document/quote-revision-schedule.test.ts` verifies a revision PDF receives the order schedule and retained IKKO number.
- `src/test/payment-plan-editor.test.tsx` verifies issued controls are disabled while a draft row remains editable.
- `src/test/quote-editor.test.tsx` verifies the inherited IKKO number is displayed.

## Verification

- Focused Vitest: 7 tests passed (`payment-plan-editor`, `quote-editor`, `admin-payment-plan-save`).
- Production build: passed (`npm run build`). Existing Vite chunk-size/dynamic-import warnings remain.
- `git diff --check`: passed.
- Full `npm test`: 128 passed, 39 failed because this worktree has no Supabase environment configuration. The failures are existing app-shell/public-page tests that throw `Supabase is not configured`; the Task 6B focused tests passed.

## Non-local database/Deno gap

- The required local SQL/RPC script was not run: `npx supabase status` reports Docker/Podman unavailable, so no local database can be started.
- Deno is not installed/on PATH in this environment, so the Deno order-document tests could not be executed here.
- No deployment, push, or main-worktree edits were performed.