# Task 6 release verification report

Date: 2026-08-30 (Australia/Sydney)
Worktree: `D:\Codex projects\IKKO HOMES agent\.worktrees\quote-payment-schedule-sdd`
Branch: `codex/quote-payment-schedule-sdd`
Supabase project: `jryybnersfuhaloxkhov`

## Results

### Client tests

Command: `npm test -- --run`

Result: **BLOCKED / FAIL** — 52 test files passed (126 tests), 14 files failed (39 tests). The failing mounted application tests all report `Supabase is not configured.` from the auth/data providers. The worktree contains `.env.example` but no `.env`; no secret values were inspected or recorded.

### Edge Function and PDF tests

Command: `npx --yes deno test --allow-env --allow-net supabase/functions/admin-invoice/index.test.ts supabase/functions/order-document/pdf.test.ts`

Result: **PASS** — 15/15 tests (8 PDF and 7 admin-invoice).

### Production build

Command: `npm run build`

Result: **PASS** — TypeScript build and Vite production build completed successfully. Output contained the existing dynamic-import notices and the existing chunk-size warning for a chunk over 500 kB; no new type/build error was emitted.

### Supabase migration

Read-only command: `npx supabase migration list --project-ref jryybnersfuhaloxkhov`

Result: **REMOTE CURRENT** — all local migrations through `202608300004` are present remotely, including `202608300001` through `202608300004` for quote/payment schedule and role provisioning.

Mutation command: `npx supabase db push --project-ref jryybnersfuhaloxkhov`

Result: **SAFETY BLOCKER** — rejected as a production-impacting database mutation. No workaround or indirect mutation was attempted. Because migration history is already current, no migration action was needed after the denial.

### Edge Function deployment

Commands requested:

- `npx supabase functions deploy admin-invoice --project-ref jryybnersfuhaloxkhov`
- `npx supabase functions deploy order-document --project-ref jryybnersfuhaloxkhov`

Result: **SAFETY BLOCKER** — both deployment mutations were rejected as external Supabase production changes. Read-only `npx supabase functions list --project-ref jryybnersfuhaloxkhov` reports `admin-invoice` and `order-document` active at remote version 3. This metadata does not prove that the current branch source is deployed.

### Manual administrator acceptance flow

Result: **BLOCKED** — no configured app environment or safely discoverable exact current administrator identity was available. The requested quote/invoice lifecycle was not exercised against live data. No service-role provisioning, fake identity, or test-data mutation was attempted.

### Vercel verification

Result: **BLOCKED** — no authenticated/linkable Vercel deployment context was available. Production completion cannot be claimed.

## Release decision

Do not report production release complete. The Deno suites, build, and remote migration history are satisfactory, but the client suite is blocked by missing environment configuration and external Supabase deployment plus manual/Vercel checks are safety/authentication-blocked.

The plan's stale push source `codex/staged-order-documents-implementation` must not be used. Any future release action must use `codex/quote-payment-schedule-sdd`.

## Worktree preservation

Pre-existing uncommitted/generated paths were preserved and not staged: `supabase/.temp/cli-latest`, `deno.lock`, and `tmp/`.


