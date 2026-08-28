# Staged Order Documents - Release Verification

Date: 2026-08-28
Branch: `codex/staged-order-documents-implementation`

## Completed release actions

- Applied remote migration `202608280023_staged_order_documents.sql` to Supabase project `jryybnersfuhaloxkhov`.
- Deployed and verified ACTIVE: `create-order`, `admin-invoice`, and `order-document`.
- Uploaded the site logo to public Storage at `site-assets/brand/ikko-logo-header.png`, the canonical PDF asset path.
- Browser suite: 61 test files and 149 tests passed.
- Production build: completed successfully.

## Remaining external configuration

`order-document` deliberately refuses email delivery until the `RESEND_API_KEY` secret is set in Supabase. The key was not present during verification. Set it only in Supabase Edge Function secrets, then redeploy `order-document` if required by the dashboard.

The local desktop environment does not include Deno, so the Edge Function unit tests could not be executed locally. The functions themselves were deployed successfully by Supabase.

## Manual acceptance checklist after the email secret is configured

1. Place a signed-in furniture order; confirm Quote v1 is created.
2. Edit and confirm the quote, then save an exact payment plan.
3. Generate instalment invoices; download one quote and one invoice PDF.
4. Verify the PDF logo, warm off-white, charcoal, orange, customer data, dates, lines, totals, and payment-plan section.
5. Email a quote and invoice to a test recipient; verify both attachments and the `order_document_deliveries` success records.
6. Mark the first invoice paid and verify the order remains invoiced; mark the final invoice paid and verify it becomes completed.
7. Verify the customer account only exposes issued invoices, due dates, and paid state.