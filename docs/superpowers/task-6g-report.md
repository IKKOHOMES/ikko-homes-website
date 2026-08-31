# Task 6G Final Edge Repair Report

Date: 2026-08-31

## Repairs

- `saveQuote` now persists drafts and confirmed revisions without invoking `ensure_quote_number`; numbering remains owned by confirmation. Revision saves continue returning the newly created quote ID for the admin UI.
- The document authorization fixture seeds through a temporary `SECURITY DEFINER` helper, switches the transaction to `authenticated`, and verifies that a customer sees only its own issued/paid invoice and lines while draft, void, and another customer’s issued records remain hidden.
- Migration 010 establishes `document_generated_at` from existing snapshots before cleanup. Cleanup consults that marker and therefore conservatively preserves download-only snapshots whose original delivery provenance cannot be reconstructed; migration 011 remains idempotent.
- `PaymentPlanEditor` assigns stable client keys, preserves local no-ID additions and local ordering through server reloads, applies server changes to clean rows, preserves dirty fields, and surfaces concurrent edit/reorder conflicts.

## Verification

- `npm test -- --run src/test/admin-api-quote-save.test.ts src/test/payment-plan-editor.test.tsx src/test/admin-schema.test.ts`: PASS (22 tests).
- `npm run build`: PASS (`tsc -b && vite build`); only existing Vite dynamic-import and chunk-size warnings were emitted.
- `git diff --check`: PASS.
- Full `npm test`: 53 test files / 139 tests passed; 14 files / 39 tests failed due the pre-existing test environment lacking `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (`Supabase is not configured.`), unrelated to Task 6G.
- Local Supabase/PostgreSQL executables were unavailable, so the forward migration and SQL fixture were statically checked but not executed locally.