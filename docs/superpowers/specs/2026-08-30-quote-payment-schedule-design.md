# Quote, Payment Schedule, and Invoice Design

## Purpose

Use a consistent IKKO Homes quote format, track staged customer payments, and automatically create one invoice draft for every approved payment-schedule line.

## Confirmed Decisions

- Quote numbers use `IKKOYYYYMM0001`, restarting at `0001` each calendar month.
- Product rates and amounts are exclusive of GST.
- GST is always 10 percent of `subtotal - discount`.
- The payment schedule replaces payment details in the quote document.
- A schedule line creates one invoice draft; drafts are editable before issue and email.

## Data and Numbering

Add a nullable, unique `quote_number` to `quotes` and a monthly counter table/function. The function must allocate the next number atomically using a locked counter row for the requested month. A quote retains its number across revisions. Existing quotes receive a number the first time an administrator edits or downloads them.

Extend `payment_plan_instalments` with `percentage numeric(7,4)`. Keep `label` as the stored description, retaining existing values. Each schedule line has description, percentage, amount, due date, sequence, and lifecycle status.

Add `draft` to the invoice status lifecycle. Draft invoice rows are private to administrators. Issued invoices may be downloaded, emailed, and marked paid. Payment-plan lines associated with issued or paid invoices are immutable.

## Admin Flow

1. A quote is automatically given its first quote number.
2. An administrator edits and confirms the quote.
3. The Payment schedule editor displays Description, Percent, Amount, and Due date.
4. Editing Percent recalculates Amount; editing Amount recalculates Percent. The last editable row absorbs rounding so totals are exactly 100 percent and exactly the quote total.
5. Saving a valid schedule creates or synchronizes one draft invoice per line. Schedule rows and draft invoices are displayed together below the quote.
6. An administrator issues an individual draft when ready, then may email its PDF to the customer. Issuing locks that draft and its schedule line.
7. Marking every issued invoice paid completes the order.

Only unissued drafts may be replaced during schedule synchronization. Any attempt to change an issued or paid schedule line is rejected with a clear administrative error.

## Document Design

PDFs use the same asset and tokens as the live site:

- Logo: `src/assets/ikko-logo-header.png` served through the existing public storage asset.
- Ink `#232220`, orange `#ed6e3a`, muted `#706b65`, and line `#e3dfda`.
- Eyebrows: Inter/Arial, 700 weight, uppercase, and 0.1em letter spacing.

The header has the logo at left and studio address, phone, email, and ABN at right. Quote and invoice number/date metadata are black. The item table has only `#`, `Item & Description`, `Quantity`, `Rate`, and `Amount`. Rate and amount are ex GST.

The final page displays subtotal, discount, GST at 10 percent, and total due. Quotes include a payment-schedule table and quote conditions. Invoices include their single corresponding payment milestone. Content overflow creates additional pages with repeated item headers; totals only appear on the final page.

## Validation and Error Handling

- Reject schedules without a description, valid positive amount, percentage, or due date.
- Reject totals that do not equal the quote total to cents, or percentages that do not total 100 percent within rounding tolerance.
- Generate human-readable errors for invalid schedules, duplicate issue attempts, and unavailable documents.
- Keep email sending separate from issue. A missing email-provider key must not prevent downloading or issuing a document.

## Tests and Verification

- Database tests cover concurrent-safe quote-number format and monthly reset.
- Payment-plan tests cover percent/amount synchronization, rounding, totals, and one invoice per schedule line.
- Edge-function tests cover the full quote and invoice PDF input shape and GST summaries.
- Render generated PDFs to PNG and inspect the actual logo, token colours, table alignment, final totals, payment schedule, and page transitions.
- Regression tests confirm issued/paid invoices cannot be changed by later schedule edits.