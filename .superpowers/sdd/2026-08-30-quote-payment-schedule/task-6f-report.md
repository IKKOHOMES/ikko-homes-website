# Task 6F — Compatibility Repair Report

## Implemented

- Added forward migration `202608300011_compatibility_repairs.sql`.
  - Quote numbers are allocated only for confirmed quotes and resolve through the revision's source quote, so a revision with a null local number returns its v1 IKKO number.
  - Quote and invoice document loads now enforce lifecycle on the server. Draft quotes cannot allocate a number, capture a snapshot, or generate a document; the admin UI also disables their document actions and the browser no longer allocates a number directly.
  - Existing draft invoice lines are normalized to one GST-exclusive representation. Issuance now refuses a draft whose line subtotal does not equal the GST-exclusive invoice subtotal.
  - First document generation records `document_generated_at`; quote schedule snapshots are captured only after confirmed release and retained as release evidence.
  - PaymentPlanEditor merges incoming server state, applying issued/paid/overdue locks without overwriting a locally edited persisted row.
- Added executable RLS lifecycle coverage for own issued/paid invoice and invoice-line visibility, with draft/void records denied by policy.
- Added frontend regressions for state refresh/locking and server-only quote-download lifecycle handling.

## Verification

- `npm test -- src/test/payment-plan-editor.test.tsx src/test/admin-document.test.ts` — PASS (10 tests). Both new regressions were observed failing before their production changes.
- `npm run build` — PASS. Existing Vite dynamic-import and chunk-size warnings remain.
- `git diff --check` — PASS.
- `npx supabase db lint` — unable to run: local Postgres at `127.0.0.1:54322` refused the connection.
- `deno check supabase/functions/order-document/index.ts` — unable to run: Deno is not installed on PATH.

No deployment, push, or main-worktree changes were made.