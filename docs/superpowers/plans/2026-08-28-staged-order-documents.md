# Staged Order Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every order into an editable quote, then issue and track custom instalment invoices with branded PDF download and Resend email delivery.

**Architecture:** Checkout snapshots verified order lines into Quote v1 and never creates an invoice directly. Admin UI confirms and edits a quote, stores a custom payment plan, and calls protected Supabase Edge Functions to issue instalment invoices and generate a single canonical PDF for either downloading or emailing through Resend. The customer account reads only issued invoices.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Supabase Postgres/RLS/Storage/Edge Functions, `pdf-lib` via ESM, Resend REST API.

**Spec:** `docs/superpowers/specs/2026-08-28-staged-order-documents-design.md`

## Global Constraints

- Use IKKO Homes’ current logo, warm off-white, charcoal, and orange palette in every generated document.
- All currency comparisons use integer cents or a two-decimal rounding helper; never compare binary floating-point totals directly.
- Only an authenticated internal administrator may edit quotes, create payment plans, issue invoices, mark invoices paid, download documents, or email documents.
- Customer accounts can read only their issued invoices and never staff notes, quote drafts, or payment-plan drafts.
- Each payment-plan amount is positive, each due date is required, and the rounded instalment total must equal the confirmed quote total before invoices can be issued.
- A paid invoice is immutable with respect to amount and due date.
- Resend uses `accounts@ikkohomes.com`; keep `RESEND_API_KEY` exclusively in Supabase Edge Function secrets.
- Every feature change starts with a failing focused test and ends with focused tests plus `npm run build`.

---

## File structure

- `supabase/migrations/202608280023_staged_order_documents.sql` — new quote, instalment, invoice, delivery-log columns, constraints, RLS policies, and service-role grants.
- `src/lib/money.ts` — cents conversion and exact-total helpers shared by admin UI logic.
- `src/lib/payment-plan.ts` — pure validation and state-transition helpers.
- `src/lib/admin-api.ts` — typed quote, plan, invoice, and delivery queries/mutations.
- `src/components/admin/QuoteEditor.tsx` — editable quote-lines editor and confirmation control.
- `src/components/admin/PaymentPlanEditor.tsx` — editable custom instalment plan.
- `src/components/admin/DocumentActions.tsx` — Download PDF and Email to customer actions.
- `src/pages/admin/AdminOrderDetailPage.tsx` — staged order workflow composition.
- `src/lib/admin-invoice.ts` — invoke the invoice-generation Edge Function and decode document downloads.
- `src/pages/CustomerAccountPage.tsx` and `src/pages/CustomerInvoicePage.tsx` — issued-invoice-only display, due date, and paid status.
- `supabase/functions/create-order/index.ts` — automatic Quote v1 creation, no direct invoice generation.
- `supabase/functions/admin-invoice/index.ts` — generate invoices for all draft instalments on a confirmed quote.
- `supabase/functions/order-document/index.ts` — admin-authorized canonical PDF generation and Resend delivery.
- `supabase/functions/order-document/pdf.ts` — document data model, branded `pdf-lib` layout, and stable filename builder.
- `supabase/functions/order-document/auth.ts` — shared administrator authentication for document generation.
- `src/test/money.test.ts`, `src/test/payment-plan.test.ts`, `src/test/quote-editor.test.tsx`, `src/test/payment-plan-editor.test.tsx`, `src/test/admin-order-documents.test.tsx` — browser-side regression coverage.
- `supabase/functions/order-document/pdf.test.ts`, `supabase/functions/admin-invoice/index.test.ts`, `supabase/functions/create-order/index.test.ts` — Deno Edge Function unit tests.

## Task 1: Add the staged-document database model

**Files:**
- Create: `supabase/migrations/202608280023_staged_order_documents.sql`
- Create: `src/lib/money.ts`
- Create: `src/test/money.test.ts`
- Modify: `src/types/domain.ts`

**Interfaces:**
- Produces `toCents(value: number): number`, `fromCents(cents: number): number`, and `hasExactTotal(amounts: number[], expected: number): boolean`.
- Adds `PaymentInstalmentStatus = 'draft' | 'issued' | 'paid' | 'overdue'` and extends `InvoiceStatus` with `'paid'`.
- Creates `payment_plan_instalments` and `order_document_deliveries`.

- [ ] **Step 1: Write the failing money test**

```ts
import { expect, test } from 'vitest';
import { hasExactTotal, toCents } from '../lib/money';

test('accepts instalments that equal a quote total to cents', () => {
  expect(toCents(100.005)).toBe(10001);
  expect(hasExactTotal([500, 250.5, 249.5], 1000)).toBe(true);
  expect(hasExactTotal([500, 250.49, 249.5], 1000)).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/test/money.test.ts --reporter=dot`

Expected: FAIL because `src/lib/money.ts` does not exist.

- [ ] **Step 3: Implement the exact-money helpers**

```ts
export function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}
export function fromCents(cents: number) {
  return cents / 100;
}
export function hasExactTotal(amounts: number[], expected: number) {
  return amounts.reduce((sum, amount) => sum + toCents(amount), 0) === toCents(expected);
}
```

- [ ] **Step 4: Write the migration**

Create:
```sql
alter type public.invoice_status add value if not exists 'paid';

alter table public.quotes
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'confirmed')),
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id);

alter table public.quote_lines
  add column if not exists is_tbd boolean not null default false;

create type public.payment_instalment_status as enum ('draft', 'issued', 'paid', 'overdue');

create table public.payment_plan_instalments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  label text not null check (length(trim(label)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  due_on date not null,
  status public.payment_instalment_status not null default 'draft',
  paid_at timestamptz,
  internal_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, sequence)
);

alter table public.invoices
  add column if not exists payment_plan_instalment_id uuid unique references public.payment_plan_instalments(id),
  add column if not exists due_on date,
  add column if not exists paid_at timestamptz;

create table public.order_document_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  document_type text not null check (document_type in ('quote', 'invoice')),
  recipient_email text not null,
  sent_at timestamptz,
  provider_message_id text,
  outcome text not null check (outcome in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  check ((document_type = 'quote' and quote_id is not null and invoice_id is null)
      or (document_type = 'invoice' and invoice_id is not null and quote_id is null))
);

alter table public.payment_plan_instalments enable row level security;
alter table public.order_document_deliveries enable row level security;
create policy "admins manage payment plans" on public.payment_plan_instalments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read delivery log" on public.order_document_deliveries for select to authenticated using (public.is_admin());
grant select, insert, update, delete on public.payment_plan_instalments to authenticated, service_role;
grant select, insert on public.order_document_deliveries to authenticated, service_role;
grant select, insert, update on public.quotes, public.quote_lines, public.invoices, public.invoice_lines to service_role;
```

Add a trigger using the project’s existing `touch_updated_at()` function for `payment_plan_instalments`.

- [ ] **Step 5: Run focused tests and migration check**

Run:
```bash
npm test -- src/test/money.test.ts --reporter=dot
npx supabase db reset --local
```

Expected: money test PASS; local migration applies without error.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202608280023_staged_order_documents.sql src/lib/money.ts src/test/money.test.ts src/types/domain.ts
git commit -m "feat: add staged order document schema"
```

## Task 2: Create automatic editable Quote v1 during checkout

**Files:**
- Modify: `supabase/functions/create-order/index.ts`
- Modify: `src/lib/order-submission.ts`
- Modify: `src/App.tsx`
- Create: `supabase/functions/create-order/index.test.ts`
- Modify: `src/test/order-submission.test.ts`

**Interfaces:**
- `create-order` returns `{ order_number: string, document_kind: 'quote-pending', discount_percent: number, furniture_discount_total: number }` for every successful order.
- `createCheckoutQuote(admin, orderId, furnitureLines, cabinetryLines): Promise<void>` inserts Quote v1 and its quote lines.

- [ ] **Step 1: Write a failing checkout quote test**

```ts
Deno.test('creates quote v1 for a furniture-only order instead of an invoice', async () => {
  const inserts: Array<{ table: string; values: unknown }> = [];
  const admin = fakeAdminRecording(inserts);
  await createCheckoutQuote(admin, 'order-1', [
    { displayName: 'Japanese Modern Sofa 041', unitPrice: 3290, quantity: 1, finish: 'Natural oak' },
  ], []);
  expect(inserts).toContainEqual({
    table: 'quotes',
    values: expect.objectContaining({ order_id: 'order-1', version: 1, status: 'draft', total: 3290 }),
  });
  expect(inserts).toContainEqual({
    table: 'quote_lines',
    values: expect.objectContaining({ display_name: 'Japanese Modern Sofa 041', is_tbd: false }),
  });
});
```

- [ ] **Step 2: Run the Deno test to verify it fails**

Run: `deno test --allow-env supabase/functions/create-order/index.test.ts`

Expected: FAIL because `createCheckoutQuote` is not exported.

- [ ] **Step 3: Implement quote snapshot creation**

After order lines and cabinetry drawings are inserted:
- Insert `quotes` with `version: 1`, `status: 'draft'`, an expiry date 30 calendar days after creation, and the sum of priced furniture lines.
- Insert one `quote_lines` row for each furniture line.
- Insert one zero-priced `quote_lines` row with `is_tbd: true` for each cabinetry line.
- Insert a `new` status event noting Quote v1 was generated.
- Remove the direct `reserve_invoice_number`, `invoices`, and `invoice_lines` checkout branch.
- Preserve current rollback behavior if quote creation fails.

- [ ] **Step 4: Update the confirmation copy and client response validation**

```ts
if (response.document_kind !== 'quote-pending') {
  throw new Error('Unable to create the order.');
}
```

Render: `Your order has been received. Quote v1 is being prepared for your review.`

- [ ] **Step 5: Run focused tests and build**

Run:
```bash
deno test --allow-env supabase/functions/create-order/index.test.ts
npm test -- src/test/order-submission.test.ts --reporter=dot
npm run build
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/create-order/index.ts supabase/functions/create-order/index.test.ts src/lib/order-submission.ts src/App.tsx src/test/order-submission.test.ts
git commit -m "feat: create quote v1 for every order"
```

## Task 3: Add quote editing and confirmation in the admin order view

**Files:**
- Create: `src/components/admin/QuoteEditor.tsx`
- Modify: `src/lib/admin-api.ts`
- Modify: `src/pages/admin/AdminOrderDetailPage.tsx`
- Create: `src/test/quote-editor.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- `QuoteEditor` takes `quote: EditableQuote` and `onSave(input: QuoteSaveInput): Promise<void>`.
- `saveQuote(input)` replaces editable quote lines, calculates `total`, and creates the next quote version only when the active quote was already confirmed.
- `confirmQuote(orderId, quoteId): Promise<void>` sets quote status to `confirmed`, order status to `quoted`, and creates an order event.

- [ ] **Step 1: Write the failing editor test**

```tsx
test('blocks quote confirmation while a line remains T.B.D.', async () => {
  const onConfirm = vi.fn();
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={onConfirm} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm quote' }));
  expect(screen.getByText('Price every quote line before confirming.')).toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/test/quote-editor.test.tsx --reporter=dot`

Expected: FAIL because `QuoteEditor` does not exist.

- [ ] **Step 3: Implement the editor**

Implement a row editor with description, quantity, unit price, `T.B.D.` toggle, add-row, remove-row, expiry date, and internal note. Calculate the displayed total from non-T.B.D. values. Require a price for every line and a non-empty expiry date before confirmation.

- [ ] **Step 4: Extend the admin API**

Add:
```ts
export type EditableQuoteLine = { id?: string; displayName: string; unitPrice: number; quantity: number; isTbd: boolean };
export type QuoteSaveInput = { quoteId: string; orderId: string; expiresOn: string; internalNote: string; lines: EditableQuoteLine[] };
export async function confirmQuote(orderId: string, quoteId: string): Promise<void> { /* status and event writes */ }
```

Use admin RLS-protected client operations and reload the order after a successful save or confirmation.

- [ ] **Step 5: Run focused tests and build**

Run:
```bash
npm test -- src/test/quote-editor.test.tsx src/test/admin-orders.test.tsx --reporter=dot
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/QuoteEditor.tsx src/lib/admin-api.ts src/pages/admin/AdminOrderDetailPage.tsx src/test/quote-editor.test.tsx src/styles/global.css
git commit -m "feat: edit and confirm order quotes"
```

## Task 4: Implement custom payment plans

**Files:**
- Create: `src/lib/payment-plan.ts`
- Create: `src/components/admin/PaymentPlanEditor.tsx`
- Modify: `src/lib/admin-api.ts`
- Modify: `src/pages/admin/AdminOrderDetailPage.tsx`
- Create: `src/test/payment-plan.test.ts`
- Create: `src/test/payment-plan-editor.test.tsx`

**Interfaces:**
- `validatePaymentPlan(instalments, quoteTotal): PaymentPlanValidation`.
- `savePaymentPlan(orderId, quoteId, instalments): Promise<void>`.
- `PaymentPlanEditor` accepts `quoteTotal: number`, persisted instalments, and `onSave`.

- [ ] **Step 1: Write the failing validation test**

```ts
test('rejects a payment plan whose instalments do not equal the confirmed quote', () => {
  expect(validatePaymentPlan([
    { label: 'Deposit', amount: 500, dueOn: '2026-09-01' },
    { label: 'Balance', amount: 499.99, dueOn: '2026-10-01' },
  ], 1000)).toEqual({ valid: false, message: 'Instalments must total $1,000.00.' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/test/payment-plan.test.ts --reporter=dot`

Expected: FAIL because `validatePaymentPlan` does not exist.

- [ ] **Step 3: Implement payment-plan validation**

```ts
export function validatePaymentPlan(instalments: PaymentPlanDraft[], quoteTotal: number): PaymentPlanValidation {
  if (!instalments.length) return { valid: false, message: 'Add at least one instalment.' };
  if (instalments.some((line) => !line.label.trim() || line.amount <= 0 || !line.dueOn)) {
    return { valid: false, message: 'Every instalment needs a name, amount and due date.' };
  }
  return hasExactTotal(instalments.map((line) => line.amount), quoteTotal)
    ? { valid: true }
    : { valid: false, message: `Instalments must total $${quoteTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}.` };
}
```

- [ ] **Step 4: Write the failing editor test**

```tsx
test('does not enable invoice generation until instalments equal the quote total', async () => {
  render(<PaymentPlanEditor quoteTotal={1000} instalments={[]} onSave={vi.fn()} onGenerate={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add instalment' }));
  expect(screen.getByRole('button', { name: 'Generate invoices' })).toBeDisabled();
});
```

- [ ] **Step 5: Implement editor and persistence**

Provide add, remove, sequence reorder, label, amount, due date, and internal-note fields. Persist only draft instalments. Disable `Generate invoices` unless the saved plan is exact and quote status is `confirmed`.

- [ ] **Step 6: Run focused tests and build**

Run:
```bash
npm test -- src/test/payment-plan.test.ts src/test/payment-plan-editor.test.tsx --reporter=dot
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/payment-plan.ts src/components/admin/PaymentPlanEditor.tsx src/lib/admin-api.ts src/pages/admin/AdminOrderDetailPage.tsx src/test/payment-plan.test.ts src/test/payment-plan-editor.test.tsx src/styles/global.css
git commit -m "feat: add staged payment plans"
```

## Task 5: Generate instalment invoices and record payment

**Files:**
- Modify: `supabase/functions/admin-invoice/index.ts`
- Modify: `src/lib/admin-invoice.ts`
- Modify: `src/lib/admin-api.ts`
- Modify: `src/pages/admin/AdminOrderDetailPage.tsx`
- Modify: `src/pages/CustomerAccountPage.tsx`
- Modify: `src/pages/CustomerInvoicePage.tsx`
- Create: `supabase/functions/admin-invoice/index.test.ts`
- Create: `src/test/admin-invoice-payment-plan.test.ts`

**Interfaces:**
- `admin-invoice` accepts `{ order_id: string }` and returns `{ invoices: Array<{ id: string; invoice_number: string; instalment_id: string }> }`.
- `markInvoicePaid(invoiceId: string, paidAt: string, note: string): Promise<void>`.
- `issuePaymentPlanInvoices(orderId): Promise<GeneratedInvoice[]>`.

- [ ] **Step 1: Write the failing Edge Function test**

```ts
Deno.test('issues one invoice for each draft instalment', async () => {
  const result = await issuePaymentPlanInvoices(fakeAdminWithConfirmedQuoteAndPlan([
    { id: 'plan-1', label: 'Deposit', amount: 500, due_on: '2026-09-01' },
    { id: 'plan-2', label: 'Balance', amount: 500, due_on: '2026-10-01' },
  ]), 'order-1');
  assertEquals(result.map((invoice) => invoice.total), [500, 500]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --allow-env supabase/functions/admin-invoice/index.test.ts`

Expected: FAIL because `issuePaymentPlanInvoices` does not exist.

- [ ] **Step 3: Implement invoice generation**

Validate administrator, confirmed quote, no `is_tbd` lines, and an exact plan total. For every draft instalment:
- reserve an invoice number;
- insert invoice with `payment_plan_instalment_id`, `due_on`, and instalment amount;
- insert a line named `${instalment.label} — ${order.order_number}`;
- mark instalment `issued`.
Then set order status `invoiced` and append one order event.

- [ ] **Step 4: Add paid-state API and UI**

```ts
export async function markInvoicePaid(invoiceId: string, paidAt: string, internalNote: string) {
  await client.from('invoices').update({ status: 'paid', paid_at: paidAt }).eq('id', invoiceId).eq('status', 'issued');
}
```

After each paid update, count issued or overdue instalments for the order. If none remain, update order status to `completed` and add a completion event.

- [ ] **Step 5: Run focused tests and build**

Run:
```bash
deno test --allow-env supabase/functions/admin-invoice/index.test.ts
npm test -- src/test/admin-invoice-payment-plan.test.ts src/test/customer-account-entry.test.tsx --reporter=dot
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-invoice/index.ts supabase/functions/admin-invoice/index.test.ts src/lib/admin-invoice.ts src/lib/admin-api.ts src/pages/admin/AdminOrderDetailPage.tsx src/pages/CustomerAccountPage.tsx src/pages/CustomerInvoicePage.tsx src/test/admin-invoice-payment-plan.test.ts
git commit -m "feat: issue and track instalment invoices"
```

## Task 6: Generate branded PDF documents and email them through Resend

**Files:**
- Create: `supabase/functions/order-document/auth.ts`
- Create: `supabase/functions/order-document/pdf.ts`
- Create: `supabase/functions/order-document/index.ts`
- Create: `supabase/functions/order-document/pdf.test.ts`
- Create: `src/components/admin/DocumentActions.tsx`
- Modify: `src/lib/admin-invoice.ts`
- Modify: `src/pages/admin/AdminOrderDetailPage.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- `buildOrderPdf(input: OrderPdfInput): Promise<{ bytes: Uint8Array; filename: string }>`.
- `order-document` accepts `{ document_type: 'quote' | 'invoice', document_id: string, action: 'download' | 'email' }`.
- `DocumentActions` accepts `documentType`, `documentId`, `recipientEmail`, and `disabled`.

- [ ] **Step 1: Write the failing PDF-data test**

```ts
Deno.test('names an invoice PDF using its invoice number', async () => {
  const result = await buildOrderPdf({
    documentType: 'invoice', reference: 'IKKO-1001', issueDate: '2026-08-28',
    dueDate: '2026-09-15', customer: customerFixture, lines: invoiceLinesFixture,
    total: 500, paymentPlan: [],
  });
  assertEquals(result.filename, 'IKKO-HOMES-IKKO-1001.pdf');
  assert(result.bytes.byteLength > 500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --allow-env supabase/functions/order-document/pdf.test.ts`

Expected: FAIL because `buildOrderPdf` does not exist.

- [ ] **Step 3: Implement canonical PDF rendering**

Use `https://esm.sh/pdf-lib@1.17.1`. Build A4 PDFs with:
- IKKO Homes logo fetched from the canonical public Storage path `site-assets/brand/ikko-logo-header.png`;
- off-white page `#F7F4EF`, charcoal `#24211F`, and orange `#F15A36`;
- client and studio blocks;
- reference, issue, expiry/due dates;
- item table, quantities, price, and total;
- quote payment-plan summary or invoice instalment label;
- studio contact footer.

Return PDF bytes and `IKKO-HOMES-${reference}.pdf`. Fail with `Unable to generate the PDF document.` if the logo or required document data cannot be loaded.

- [ ] **Step 4: Implement administrator-only delivery**

For `download`, return JSON `{ filename, pdf_base64 }`. For `email`, call:
```ts
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'IKKO HOMES <accounts@ikkohomes.com>',
    to: [recipientEmail],
    subject: `${documentType === 'quote' ? 'Quote' : 'Invoice'} ${reference} from IKKO HOMES`,
    html: '<p>Your IKKO Homes document is attached.</p>',
    attachments: [{ filename, content: encodeBase64(pdfBytes) }],
  }),
});
```

Insert one `order_document_deliveries` row for every success or failure. Never expose `RESEND_API_KEY` in the browser response.

- [ ] **Step 5: Add action tests**

```tsx
test('downloads a quote PDF returned by the document function', async () => {
  vi.mocked(invokeOrderDocument).mockResolvedValue({ filename: 'IKKO-HOMES-Q-1.pdf', pdfBase64: 'JVBERi0=' });
  render(<DocumentActions documentType="quote" documentId="quote-1" recipientEmail="client@example.com" />);
  await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  expect(URL.createObjectURL).toHaveBeenCalled();
});
```

Also test that Email to customer disables while sending and reports `Unable to email this document.` on function failure.

- [ ] **Step 6: Configure and verify the secret outside source control**

Run:
```bash
npx supabase secrets set RESEND_API_KEY=<value> --project-ref jryybnersfuhaloxkhov
npx supabase functions deploy order-document --project-ref jryybnersfuhaloxkhov
```

Use a Resend test recipient first, then check `order_document_deliveries` for a `sent` outcome.

- [ ] **Step 7: Run focused tests and build**

Run:
```bash
deno test --allow-env supabase/functions/order-document/pdf.test.ts
npm test -- src/test/admin-order-documents.test.tsx --reporter=dot
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/order-document src/components/admin/DocumentActions.tsx src/lib/admin-invoice.ts src/pages/admin/AdminOrderDetailPage.tsx src/styles/global.css src/test/admin-order-documents.test.tsx
git commit -m "feat: download and email order documents"
```

## Task 7: Verify migrations, permissions, and end-to-end lifecycle

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-staged-order-documents-design.md` only if verification exposes a spec correction.
- Create: `docs/superpowers/plans/2026-08-28-staged-order-documents-verification.md` with recorded release evidence.

**Interfaces:**
- Uses the schema and functions from Tasks 1–6; introduces no application API.

- [ ] **Step 1: Apply the migration to a linked staging/local project**

Run:
```bash
npx supabase migration list --linked
npx supabase db push --linked
```

Expected: `202608280023_staged_order_documents` is applied once and the remote list matches local migrations.

- [ ] **Step 2: Deploy Edge Functions**

Run:
```bash
npx supabase functions deploy create-order --project-ref jryybnersfuhaloxkhov
npx supabase functions deploy admin-invoice --project-ref jryybnersfuhaloxkhov
npx supabase functions deploy order-document --project-ref jryybnersfuhaloxkhov
npx supabase functions list --project-ref jryybnersfuhaloxkhov
```

Expected: all three functions have status `ACTIVE`.

- [ ] **Step 3: Run the complete focused suite**

Run:
```bash
npm test -- src/test/money.test.ts src/test/order-submission.test.ts src/test/quote-editor.test.tsx src/test/payment-plan.test.ts src/test/payment-plan-editor.test.tsx src/test/admin-invoice-payment-plan.test.ts src/test/admin-order-documents.test.tsx --reporter=dot
npm run build
```

Expected: PASS. Record existing unrelated test failures separately; do not mask them.

- [ ] **Step 4: Perform the staged manual acceptance test**

1. Submit a furniture order while signed in.
2. Confirm Quote v1 exists with frozen furniture price.
3. Edit quote, set expiry, and confirm it.
4. Create two instalments whose total equals the quote.
5. Generate both invoices.
6. Download a Quote PDF and an Invoice PDF; verify logo, colours, customer, dates, lines, totals, and payment plan.
7. Email one Quote and one Invoice to a test recipient; verify attachments and two delivery-log rows.
8. Mark the first invoice paid; verify the order stays invoiced.
9. Mark the final invoice paid; verify order becomes completed.
10. Confirm customer account shows only issued invoices with due dates and paid status.

- [ ] **Step 5: Commit verification evidence**

```bash
git add docs/superpowers/plans/2026-08-28-staged-order-documents-verification.md
git commit -m "docs: verify staged order documents"
```
