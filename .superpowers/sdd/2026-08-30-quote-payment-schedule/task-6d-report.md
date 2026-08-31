# Task 6D — Consistency Remediation Report

## Implemented

- Added forward migration `202608300008_quote_document_consistency.sql`.
  - Payment schedules are captured as per-quote JSON snapshots. A before-relink trigger preserves the old revision before draft rows move to a newer quote, and later schedule edits update only the active revision snapshot.
  - Added `confirm_quote`, which locks the order and quote, validates complete quote lines, confirms the quote, and preserves `invoiced` or `completed` order status rather than regressing it to `quoted`.
  - Added `load_authorised_order_document`, a security-definer RPC that checks the final customer ownership/admin role and invoice eligibility while loading the complete document payload. Invoice rows, order/customer ownership, quote data, invoice lines, schedule snapshots, and studio details are returned as one bounded transaction.
- The Edge Function now builds documents only from that bounded RPC payload. The remaining direct quote loader used by focused tests reads the immutable snapshot table rather than the mutable order schedule.
- Payment-plan saves return the persisted instalment IDs from the atomic RPC. `PaymentPlanEditor` replaces its local draft lines with those rows, so another save before a reload updates the same drafts instead of recreating invoices/numbers.
- Quote confirmation now calls the lifecycle RPC rather than separately writing quote, order, and event rows from the browser.

## Regressions

- SQL lifecycle coverage verifies a revision confirmed after an issued invoice remains `invoiced`, later mark-paid still reaches `completed`, and v1/v2 schedule snapshots retain their respective schedule content.
- Vitest verifies persisted IDs are returned and submitted by a consecutive pre-reload save, including the editor’s local state behavior.
- Deno verifies final document data is loaded through the authorization-bounded RPC, rejects a void invoice from that final load, and quote revision PDF tests read snapshots rather than mutable schedules.

## Verification

- Focused Vitest: 7/7 passed (`admin-payment-plan-save`, `payment-plan-editor`).
- Focused Deno tests: 13/13 passed (`order-document/index`, `quote-revision-schedule`).
- Deno check passed for `order-document/index.ts` and `pdf.ts`.
- `npm run build` passed; existing Vite dynamic-import/chunk-size warnings remain.
- `git diff --check` passed.

## Environment limitations

- `npx supabase db lint` could not connect because the local Postgres endpoint at `127.0.0.1:54322` is not running. The SQL regression is included for a reset local Supabase database.
- The full frontend test suite has 39 pre-existing environment failures caused by missing Supabase configuration; the focused Task 6D suites pass.
- No deployment, push, or main-worktree changes were performed.