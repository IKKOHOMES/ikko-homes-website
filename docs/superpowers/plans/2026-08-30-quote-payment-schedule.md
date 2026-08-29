# Quote and Payment Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce branded IKKO Homes quotes with monthly quote numbers, a GST-exclusive payment schedule, and one invoice draft per scheduled payment.

**Architecture:** PostgreSQL owns unique quote numbering, financial values, schedule state, and invoice lifecycle. React renders and edits schedule rows through existing admin APIs, while Supabase Edge Functions synchronize drafts and issue individual invoices. The order-document Edge Function renders the approved document layout from explicit financial totals.

**Tech Stack:** React, TypeScript, Vite, Vitest, Supabase Postgres, Supabase Edge Functions (Deno), pdf-lib.

**Spec:** `docs/superpowers/specs/2026-08-30-quote-payment-schedule-design.md`

## Global Constraints

- Quote number format is `IKKOYYYYMM0001`; the sequence restarts at `0001` every calendar month.
- Rates and amounts are exclusive of GST; use `subtotal - discount + 10% GST = total due`.
- Use `src/assets/ikko-logo-header.png`, `#232220`, `#ed6e3a`, `#706b65`, and `#e3dfda` in PDFs.
- Eyebrows use the site UI font at 700 weight, uppercase, and 0.1em letter spacing.
- A payment schedule line has description, percent, amount, and due date; a valid schedule totals 100 percent and the quote total to cents.
- Saving a valid schedule synchronizes one draft invoice per schedule line. Issued and paid schedule lines cannot be changed.
- Email remains separate from issuing an invoice and must never block PDF downloads.

## File Structure

- `supabase/migrations/202608300001_quote_payment_schedule.sql`: quote number counter, financial columns, payment percentages, draft invoice status, and database triggers/functions.
- `src/lib/payment-plan.ts`: deterministic percentage/amount conversion and schedule validation.
- `src/lib/admin-api.ts`: quote totals, schedule persistence, quote-number backfill, and typed admin data mapping.
- `src/lib/admin-invoice.ts`: client adapters for synchronizing drafts and issuing one draft.
- `supabase/functions/admin-invoice/index.ts`: idempotent schedule-to-draft synchronization and per-invoice issue action.
- `src/components/admin/PaymentPlanEditor.tsx`: Description, Percent, Amount, and Due date editor.
- `src/pages/admin/AdminOrderDetailPage.tsx`: quote number, schedule save/sync action, and per-invoice draft/issue controls.
- `supabase/functions/order-document/pdf.ts`: multi-page branded quote/invoice PDF layout and GST summary.
- Tests under `src/test/` and `supabase/functions/**/**.test.ts`: business rules, UI behavior, Edge Function behavior, and PDF rendering input.

---

### Task 1: Add quote numbering, financial totals, payment percentages, and draft invoice lifecycle

**Files:**
- Create: `supabase/migrations/202608300001_quote_payment_schedule.sql`
- Modify: `src/types/domain.ts`
- Test: `src/test/quote-number-format.test.ts`

**Interfaces:**
- Produces database function `public.ensure_quote_number(p_quote_id uuid) returns text`.
- Produces `quotes.quote_number`, `quotes.subtotal`, `quotes.discount_total`, `quotes.gst_total`, and `payment_plan_instalments.percentage`.
- Extends `InvoiceStatus` with `'draft'`.

- [ ] **Step 1: Write the failing quote-number-format test**

```ts
import { formatQuoteNumber } from '../lib/quote-number';

test('formats a monthly quote number without separators', () => {
  expect(formatQuoteNumber('2026-08-30', 1)).toBe('IKKO2026080001');
  expect(formatQuoteNumber('2026-08-30', 42)).toBe('IKKO2026080042');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run src/test/quote-number-format.test.ts`

Expected: FAIL because `src/lib/quote-number.ts` does not exist.

- [ ] **Step 3: Implement the pure formatter and migration**

```ts
export function formatQuoteNumber(isoDate: string, sequence: number) {
  const period = isoDate.slice(0, 7).replace('-', '');
  return `IKKO${period}${String(sequence).padStart(4, '0')}`;
}
```

Create a `quote_number_counters(period char(6) primary key, last_sequence integer not null)` table. Add `quote_number text unique`, `subtotal numeric(12,2)`, `discount_total numeric(12,2) default 0`, and `gst_total numeric(12,2) default 0` to `quotes`; add `percentage numeric(7,4)` to `payment_plan_instalments`; add `draft` to `invoice_status`. Implement `ensure_quote_number` using `insert ... on conflict ... do update ... returning last_sequence`, then update the quote only when `quote_number is null`. Grant execution only to `authenticated` and `service_role`.

- [ ] **Step 4: Update TypeScript invoice status and run the focused test**

```ts
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';
```

Run: `npm test -- --run src/test/quote-number-format.test.ts`

Expected: PASS.

- [ ] **Step 5: Apply and inspect the migration in the linked Supabase project**

Run: `npx supabase db push --project-ref jryybnersfuhaloxkhov`

Expected: migration succeeds; `ensure_quote_number` is callable by the administrator client and `draft` is accepted by `invoices.status`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202608300001_quote_payment_schedule.sql src/lib/quote-number.ts src/types/domain.ts src/test/quote-number-format.test.ts
git commit -m "feat: add monthly quote numbering and draft invoices"
```

### Task 2: Make quote financial totals and payment schedule math deterministic

**Files:**
- Modify: `src/lib/payment-plan.ts`
- Modify: `src/lib/admin-api.ts`
- Modify: `src/components/admin/QuoteEditor.tsx`
- Test: `src/test/payment-plan.test.ts`
- Test: `src/test/payment-plan-editor.test.tsx`

**Interfaces:**
- Produces `calculateQuoteTotals(lines, discountTotal)` returning `{ subtotal, discountTotal, gstTotal, total }`.
- Produces `updateSchedulePercent(lines, index, percentage, quoteTotal)` and `updateScheduleAmount(lines, index, amount, quoteTotal)`.
- `PaymentPlanDraft` contains `{ id?, label, percentage, amount, dueOn, internalNote }`.

- [ ] **Step 1: Add failing calculation and rounding tests**

```ts
expect(calculateQuoteTotals([{ quantity: 2, unitPrice: 100 }], 20)).toEqual({
  subtotal: 200, discountTotal: 20, gstTotal: 18, total: 198,
});
expect(updateSchedulePercent([{ label: 'Deposit', percentage: 50, amount: 0, dueOn: '2026-09-01', internalNote: '' }, { label: 'Final', percentage: 50, amount: 0, dueOn: '2026-10-01', internalNote: '' }], 0, 33.33, 1000)[1].amount).toBe(666.7);
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- --run src/test/payment-plan.test.ts src/test/payment-plan-editor.test.tsx`

Expected: FAIL because the quote-total and synchronized-edit helpers do not exist and the form has no Percent field.

- [ ] **Step 3: Implement financial and schedule helpers**

Use integer cents for all money arithmetic. Compute `gstTotal` as `roundCents((subtotal - discountTotal) * 0.10)`. When a percentage changes, recalculate that amount and set the final editable line to `quoteTotal - other amounts`; when an amount changes, recalculate its percentage from `amount / quoteTotal * 100` and likewise correct the final line. Reject any negative discount, percentage, amount, or empty due date/description.

- [ ] **Step 4: Persist explicit quote totals and percentages**

Update `saveQuote` to write `subtotal`, `discount_total`, `gst_total`, and `total`; add a Discount field to `QuoteEditor`. Update `savePaymentPlan` to store `percentage` and `amount`. Before saving or downloading a quote, call `ensure_quote_number` when no `quote_number` is present.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `npm test -- --run src/test/payment-plan.test.ts src/test/payment-plan-editor.test.tsx`

Expected: PASS, including 10 percent GST and exact-cent total assertions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/payment-plan.ts src/lib/admin-api.ts src/components/admin/QuoteEditor.tsx src/test/payment-plan.test.ts src/test/payment-plan-editor.test.tsx
git commit -m "feat: calculate GST and payment percentages"
```

### Task 3: Synchronize payment schedule lines to draft invoices and issue them individually

**Files:**
- Modify: `supabase/functions/admin-invoice/index.ts`
- Modify: `supabase/functions/admin-invoice/index.test.ts`
- Modify: `src/lib/admin-invoice.ts`
- Modify: `src/test/admin-invoice.test.ts`

**Interfaces:**
- `synchronisePaymentPlanInvoices(repository, orderId)` returns one `{ id, invoice_number, instalment_id, status: 'draft' }` per draft schedule row.
- Edge body accepts `{ action: 'sync', order_id }` and `{ action: 'issue', order_id, invoice_id }`.
- Client exports `synchroniseInvoiceDrafts(orderId)` and `issueInvoice(orderId, invoiceId)`.

- [ ] **Step 1: Replace the current issuing test with failing draft-synchronization tests**

```ts
Deno.test('creates one draft invoice for each payment schedule line', async () => {
  const created = await synchronisePaymentPlanInvoices(repository, 'order-1');
  assertEquals(created.map((invoice) => invoice.status), ['draft', 'draft']);
  assertEquals(inserted.map((invoice) => invoice.total), [500, 500]);
});

Deno.test('does not replace an issued payment schedule line', async () => {
  await assertRejects(() => synchronisePaymentPlanInvoices(issuedRepository, 'order-1'), Error, 'Issued instalments cannot be changed.');
});
```

- [ ] **Step 2: Run the Edge tests to verify they fail**

Run: `npx --yes deno test --allow-env --allow-net supabase/functions/admin-invoice/index.test.ts`

Expected: FAIL because the current function creates `issued` invoices and has no sync action.

- [ ] **Step 3: Implement idempotent draft synchronization**

For every `payment_plan_instalments.status = 'draft'`, insert or update a matching `invoices` row with `status: 'draft'`, exact amount, due date, customer snapshot, and one invoice line. Delete only stale draft invoices that have no issued/paid relationship. Do not mutate issued or paid invoices. Set order status to `invoiced` only after the first draft is explicitly issued.

- [ ] **Step 4: Implement issue action and typed client adapters**

The `issue` action must require a draft invoice owned by the given order, update it to `issued`, update its instalment to `issued`, and add an order status event. `normaliseInvoiceResponse` must accept the draft status and reject malformed responses.

- [ ] **Step 5: Run Edge and client tests to verify they pass**

Run: `npx --yes deno test --allow-env --allow-net supabase/functions/admin-invoice/index.test.ts`

Run: `npm test -- --run src/test/admin-invoice.test.ts`

Expected: PASS.

- [ ] **Step 6: Deploy the function to a staging-safe live project check and commit**

Run: `npx supabase functions deploy admin-invoice --project-ref jryybnersfuhaloxkhov`

Then commit:

```bash
git add supabase/functions/admin-invoice/index.ts supabase/functions/admin-invoice/index.test.ts src/lib/admin-invoice.ts src/test/admin-invoice.test.ts
git commit -m "feat: create invoice drafts from payment schedules"
```

### Task 4: Update the admin payment schedule and invoice controls

**Files:**
- Modify: `src/components/admin/PaymentPlanEditor.tsx`
- Modify: `src/pages/admin/AdminOrderDetailPage.tsx`
- Modify: `src/lib/admin-api.ts`
- Modify: `src/styles/global.css`
- Test: `src/test/payment-plan-editor.test.tsx`
- Test: `src/test/admin-order-detail.test.tsx`

**Interfaces:**
- `PaymentPlanEditor` calls `onSave(instalments)` only for a valid 100-percent plan and `onSync()` only after save succeeds.
- `AdminOrderDetailPage` renders `Issue invoice` for drafts, `Mark paid` for issued invoices, and `DocumentActions` only for issued/paid documents.

- [ ] **Step 1: Add failing admin UI tests**

```tsx
expect(screen.getByRole('spinbutton', { name: 'Instalment 1 percent' })).toHaveValue(50);
expect(screen.getByRole('button', { name: 'Save payment schedule' })).toBeEnabled();
expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Email invoice' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run focused UI tests to verify they fail**

Run: `npm test -- --run src/test/payment-plan-editor.test.tsx src/test/admin-order-detail.test.tsx`

Expected: FAIL because the current editor has Amount but no Percent field, and invoices are generated/issued in one operation.

- [ ] **Step 3: Implement the schedule editor**

Display Description, Percent, Amount, Due date, Internal note, move controls, and Remove. Recalculate immediately after editing Percentage or Amount. Replace `Generate invoices` with `Save payment schedule` followed by `Sync invoice drafts`; after sync, reload the order detail.

- [ ] **Step 4: Implement invoice lifecycle controls**

Render each draft invoice with its payment description, amount, due date, and `Issue invoice` action. On success, reload so Download PDF and Email Invoice appear only for issued or paid invoices. Preserve `Mark paid` for issued invoices.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `npm test -- --run src/test/payment-plan-editor.test.tsx src/test/admin-order-detail.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/PaymentPlanEditor.tsx src/pages/admin/AdminOrderDetailPage.tsx src/lib/admin-api.ts src/styles/global.css src/test/payment-plan-editor.test.tsx src/test/admin-order-detail.test.tsx
git commit -m "feat: manage payment schedule invoice drafts"
```

### Task 5: Rebuild quote and invoice PDFs to the approved branded format

**Files:**
- Modify: `supabase/functions/order-document/pdf.ts`
- Modify: `supabase/functions/order-document/index.ts`
- Modify: `supabase/functions/order-document/pdf.test.ts`
- Test: `supabase/functions/order-document/index.test.ts`

**Interfaces:**
- `OrderPdfInput` contains `number`, `issuedOn`, `customer`, `studio`, `lines`, `subtotal`, `discountTotal`, `gstTotal`, `totalDue`, `paymentSchedule?`, and `invoiceMilestone?`.
- `buildOrderPdf(input)` returns `{ bytes: Uint8Array, filename: string }` and creates all needed pages.

- [ ] **Step 1: Add failing branded-summary tests**

```ts
const result = await buildOrderPdf({
  documentType: 'quote', number: 'IKKO2026080001', issuedOn: '2026-08-30',
  subtotal: 3000, discountTotal: 100, gstTotal: 290, totalDue: 3190,
  paymentSchedule: [{ description: 'Deposit', percentage: 50, amount: 1595, dueOn: '2026-09-15' }],
  // customer, studio, and line fixtures
});
assert(result.bytes.byteLength > 1_000);
assertEquals(result.filename, 'IKKO-HOMES-IKKO2026080001.pdf');
```

- [ ] **Step 2: Run the PDF test to verify it fails**

Run: `npx --yes deno test --allow-env --allow-net supabase/functions/order-document/pdf.test.ts`

Expected: FAIL because the input currently has only `reference` and a single `total`.

- [ ] **Step 3: Implement paginated layout helpers**

Create `newPage()`, `drawHeader()`, `drawItemHeader()`, and `ensureVerticalSpace()` helpers in `pdf.ts`. `drawHeader()` embeds the existing `ikko-logo-header.png`, uses the exact design tokens, draws studio contact details and ABN, and uses eyebrow typography only for orange labels. Repeat the item header on continuation pages.

- [ ] **Step 4: Implement quote and invoice content**

Draw the black table header with exactly `#`, `Item & Description`, `Quantity`, `Rate`, and `Amount`. Format rate as `$${unitPrice.toFixed(2)} / ${unit}` where a unit exists. Draw subtotal, discount, GST 10 percent, and total due on the final page. Quote metadata is black, and quotes show Description, Percent, Amount, Due date schedule rows plus Quote conditions. Invoice PDFs show only their linked milestone.

- [ ] **Step 5: Update data loading and run PDF tests**

Load `quote_number`, explicit financial totals, percentage, and invoice milestone values in `order-document/index.ts`. For a legacy quote without a number, call `ensure_quote_number` before building its document.

Run: `npx --yes deno check supabase/functions/order-document/index.ts`

Run: `npx --yes deno test --allow-env --allow-net supabase/functions/order-document/pdf.test.ts`

Expected: PASS.

- [ ] **Step 6: Render and inspect PDF pages**

Generate representative quote and invoice PDFs, render with Poppler, and inspect PNGs for the true logo, colours, black metadata, rate/unit placement, GST summary, payment schedule, and page-header repetition. Correct any overlap or clipping before deployment.

- [ ] **Step 7: Deploy and commit**

Run: `npx supabase functions deploy order-document --project-ref jryybnersfuhaloxkhov`

Then commit:

```bash
git add supabase/functions/order-document/pdf.ts supabase/functions/order-document/index.ts supabase/functions/order-document/pdf.test.ts supabase/functions/order-document/index.test.ts
git commit -m "feat: redesign quote and invoice PDFs"
```

### Task 6: Run end-to-end verification and release

**Files:**
- Modify: `docs/superpowers/plans/2026-08-30-quote-payment-schedule.md`
- Test: `src/test/**/*.test.tsx`
- Test: `supabase/functions/admin-invoice/index.test.ts`
- Test: `supabase/functions/order-document/pdf.test.ts`

**Interfaces:**
- Consumes all prior schema, client, Edge Function, and PDF interfaces.
- Produces a production-ready rollout with GitHub `main`, Supabase migrations/functions, and a documented verification record.

- [ ] **Step 1: Run all client and Edge tests**

Run: `npm test -- --run`

Run: `npx --yes deno test --allow-env --allow-net supabase/functions/admin-invoice/index.test.ts supabase/functions/order-document/pdf.test.ts`

Expected: all tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit code 0. Treat only the existing Vite chunk-size warning as non-blocking; fix any new type or build error.

- [ ] **Step 3: Execute a manual administrator acceptance flow**

1. Create or open a quote and verify `IKKOYYYYMM0001` appears.
2. Confirm the quote and create a two-line 50/50 schedule with different due dates.
3. Save and verify exactly two invoice drafts appear.
4. Issue one draft, download its PDF, and verify Email is available only after issue.
5. Mark the invoice paid; issue and pay the second invoice; verify the order becomes Completed.
6. Download a quote and verify Subtotal, Discount, 10 percent GST, Total due, payment schedule, and the correct header asset.

- [ ] **Step 4: Release source and record evidence**

```bash
git add docs/superpowers/plans/2026-08-30-quote-payment-schedule.md
git commit -m "docs: record quote payment schedule verification"
git push origin codex/staged-order-documents-implementation:main
```

Verify Supabase migration and both Edge Function deployments report success. Verify Vercel finishes the Git-connected production deployment before reporting completion.