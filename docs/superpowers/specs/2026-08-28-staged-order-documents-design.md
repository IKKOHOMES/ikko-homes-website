# Staged Quote, Payment Plan, Invoice, PDF, and Email Design

## Goal

Move every order to a staged commercial workflow:

`Order → Quote → Customer confirmation → Payment plan → Instalment invoices → Paid → Completed`.

The system must let staff download and email consistent IKKO Homes-branded quote and invoice PDFs.

## Scope

- Every submitted order creates Quote v1 automatically.
- Staff can edit quotes, including lines, total, expiry date, and internal note.
- A quote can contain priced furniture and cabinetry. Cabinetry starts as `T.B.D.` until staff sets a price.
- Staff can define any number of payment-plan instalments with a label, amount, due date, status, payment date, and internal note.
- Payment-plan amounts must equal the confirmed quote total before invoices can be generated.
- Each instalment becomes a separate invoice. Staff can download, email, and mark each one paid.
- An order completes automatically when every issued instalment invoice is marked paid.
- Staff can download or email any quote and any issued invoice.
- The customer account exposes only issued invoices and their payment state; it never exposes staff drafts or internal notes.

## State model

### Order

`new → quoted → invoiced → completed`

- `new`: quote is automatically created and can be edited by staff.
- `quoted`: staff has confirmed the quote and is ready to create or adjust the payment plan.
- `invoiced`: one or more instalment invoices have been issued.
- `completed`: every issued instalment invoice is paid.

### Payment instalment

`draft → issued → paid → overdue`

- `draft`: editable plan line, not visible to the customer.
- `issued`: an invoice exists and may be downloaded or emailed.
- `paid`: staff recorded payment date and optional internal payment note.
- `overdue`: derived or manually set when an issued invoice remains unpaid after its due date.

## Data model

### Quotes

Existing `quotes` and `quote_lines` remain the source of truth for quote versions. A quote created at checkout snapshots current priced furniture lines. Cabinetry lines initially use a zero line value and are labelled `T.B.D.`; staff replaces these with a confirmed price before invoice generation.

### Payment plan

Add `payment_plan_instalments`:

- `id`
- `order_id`
- `quote_id` (the confirmed quote version)
- `sequence`
- `label`
- `amount`
- `due_on`
- `status`
- `paid_at` nullable
- `internal_note`
- `created_at`, `updated_at`

A unique constraint enforces one sequence number per order. Server-side validation requires the sum of instalments to equal the confirmed quote total, rounded to cents.

### Invoices

Extend `invoices` with `payment_plan_instalment_id` (unique and nullable for historic invoices), `due_on`, and `paid_at`. Each generated instalment invoice uses the instalment amount and label as its invoice line.

### Delivery log

Add `order_document_deliveries` to record each email attempt:

- document type (`quote` or `invoice`)
- related quote or invoice ID
- recipient email
- sent timestamp
- provider message ID when available
- delivery outcome/error

This is an audit log, not a customer-visible message history.

## Admin workflow

1. On order creation, create Quote v1 automatically.
2. Staff review/edit quote lines, total, expiry, and note.
3. Staff download a quote PDF or email it to the customer.
4. Once customer confirmation is recorded, staff adds custom payment-plan instalments.
5. The interface blocks invoice generation until instalments equal the quote total.
6. Staff generates all instalment invoices.
7. For each invoice, staff can download PDF, email the customer, and mark it paid.
8. The order becomes completed after all issued invoices are paid.

## PDF and email documents

A protected Supabase Edge Function generates both download and email documents, so the email attachment and browser download are identical.

Documents use:
- current IKKO Homes logo
- warm off-white background
- charcoal typography
- IKKO orange accents
- customer and studio details
- quote/invoice reference and dates
- itemised lines, totals, and payment-plan context
- footer contact details

Quote PDFs include status, expiry date, and payment-plan summary when one exists. Invoice PDFs include the instalment label, exact amount due, and due date.

Only administrators can call document generation or email functions. Email is sent through Resend from `accounts@ikkohomes.com`, using the recipient stored on the order/customer record. Re-sends are permitted and recorded.

## Customer experience

The customer account lists only issued invoices, with invoice number, amount, due date, and status. A customer can open or save the invoice PDF but cannot edit quotes, payment plans, or internal notes.

## Error handling and permissions

- An administrator-only Edge Function validates document and email requests.
- PDF generation or email failures show an actionable admin error and are logged in `order_document_deliveries`.
- A payment plan cannot issue invoices if its total differs from the confirmed quote total.
- Paid invoices cannot be edited back into a different amount.
- Customer RLS policies limit records to the customer’s own order chain.
- The Edge Function uses service-role access with only the required table privileges.

## Testing

- Unit tests for quote total and instalment-total validation, invoice state transitions, and document data mapping.
- Admin UI tests for adding/removing instalments, total mismatch blocking, invoice generation, marking paid, and document actions.
- Edge-function tests for administrator authorization, PDF payload selection, Resend request handling, and delivery logging.
- Migration verification for new constraints, RLS policies, and service-role grants.
- End-to-end manual check: submit order, edit quote, create plan, issue invoices, download PDF, send email, mark all paid, verify completed status.

## Out of scope

- Online card or bank-payment processing.
- Automatic payment reconciliation from a bank feed.
- Automated reminder emails.
- Digital signing of quotes.
