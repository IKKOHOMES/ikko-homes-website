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
## P1 review correction

- Added forward migration `202608300009_document_authorisation_snapshot_freeze.sql`.
  - `load_authorised_order_document` now accepts only document type and ID. It derives the caller from `auth.uid()` and administrator status from `public.is_admin()` inside the security-definer RPC; `service_role` remains an explicit supported privileged caller. The obsolete four-argument RPC is dropped and the new RPC is granted only to `authenticated` and `service_role`.
  - The Edge Function invokes that RPC through a JWT-scoped anon client constructed from the verified request token. It no longer passes application-supplied caller IDs or role flags, while the service-role client remains limited to delivery logging.
  - Explicit administrators can load documents for guest customers with no `auth_user_id`; customer callers still require matching ownership.
  - Snapshots are immutable (`ON CONFLICT DO NOTHING`) and schedule triggers are removed. A schedule can change while its quote has not been released; the first authorised quote document load freezes the current schedule. Existing snapshot rows remain frozen.
- Added Deno tests asserting no caller ID/admin flag is sent to the RPC and that database-authorised guest payloads are accepted. SQL coverage now freezes a same-revision schedule on document generation, then proves a later schedule save cannot alter the released PDF snapshot.

### P1 verification

- Focused Deno tests: 16/16 passed (`auth`, `index`, `quote-revision-schedule`).
- Focused Vitest: 7/7 passed.
- Deno check and frontend build passed. Existing Vite warnings remain.
- `git diff --check` passed.
## P2 authorization integration coverage

- Added executable `supabase/tests/document_authorisation_rpc_integration.sql` for a reset local Supabase database or disposable staging database. It creates actual `auth.users`/profiles/customer fixtures and invokes the two-argument RPC under `authenticated` JWT claim GUCs, as PostgREST does.
- The fixture asserts: an explicit authenticated admin may load a guest order; an authenticated non-admin cannot; a customer can load only their own order; and the obsolete four-argument spoofable signature is absent.
- Added an Edge-level Deno test that uses the real Supabase client construction with a mocked fetch boundary. It verifies the RPC HTTP request carries `Bearer verified-customer-jwt` and the anon API key, never the service-role credential.

### P2 verification

- Focused Deno tests: 17/17 passed.
- Focused Vitest: 7/7 passed.
- Deno check, frontend build, and `git diff --check` passed.
- The SQL fixture is executable but unrun here because the local Postgres service is unavailable.