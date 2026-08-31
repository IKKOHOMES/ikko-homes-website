# Quote Payment Schedule Final DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the quote payment-schedule release database path without exposing internal counters or freezing mutable drafts.

**Architecture:** Add one forward-only migration after 011. It removes unproven legacy release markers, rebuilds evidence-backed snapshot rows by quote revision, restricts the two internal tables, and replaces the document loader with common-prefix exclusive locks. SQL integration fixtures exercise the actual RPC and table policies.

**Tech Stack:** Supabase/PostgreSQL migrations, PL/pgSQL, psql SQL integration fixtures.

**Spec:** `.superpowers/sdd/2026-08-30-quote-payment-schedule/task-6h-final-db-brief.md`

## Global Constraints

- Use a forward migration only; do not edit releases 008–011.
- Do not deploy, push, or change main.
- Preserve immutable issued/paid milestones while excluding later revision drafts.

### Task 1: Forward hardening and snapshot repair

**Files:**
- Create: `supabase/migrations/202608300012_final_db_release_repairs.sql`
- Test: `supabase/tests/quote_lifecycle_rpc.sql`

- [ ] Write a fixture that asserts a v2 snapshot contains the prior issued milestone and only its own draft rows, then verify it fails before the migration.
- [ ] Add cleanup, revision-aware snapshot capture, RLS/privilege hardening, and a common-order final-lock document loader.
- [ ] Run the fixture against a reset disposable database and verify it passes.

### Task 2: RPC authorization fixture repair

**Files:**
- Modify: `supabase/tests/document_authorisation_rpc_integration.sql`

- [ ] Change auth user metadata fixtures to include valid first/last names so the production auth trigger creates customers.
- [ ] Run the fixture with actual authenticated-role assertions and verify it reaches the lifecycle assertions.

### Task 3: Verification and report

**Files:**
- Create: `.superpowers/sdd/2026-08-30-quote-payment-schedule/task-6h-report.md`

- [ ] Run migration checks, SQL fixtures, unit tests, and build.
- [ ] Record commands and results, inspect the final diff, and commit the scoped files.