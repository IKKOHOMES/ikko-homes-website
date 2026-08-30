# Task 5 PDF Repair Report

Date: 2026-08-30

## Repair

Restored the order-document line-item rendering loop after the item-table header. Every input line now renders its number, wrapped description (including finish), quantity, rate/unit, and amount. Rows are never truncated; a full row moves to a continuation page when it cannot fit, with `ITEMS CONTINUED` and the complete item-table header repeated.

## Automated verification

- `npx --yes deno test --allow-env --allow-net supabase/functions/order-document/pdf.test.ts`: PASS (3 tests).
- Long quote fixture test asserts all 36 distinct item descriptions in decoded PDF content, `PDFDocument.getPageCount() >= 2`, and `ITEMS CONTINUED` in PDF content.
- `npx --yes deno check supabase/functions/order-document/index.ts`: PASS.
- `git diff --check`: PASS.

## Rendered fixture

- PDF: `output/pdf/quote-payment-schedule-fixture.pdf`
- SHA-256: `64BD9F9EF4A1033A3CA333A3C7D588F118AB9B79A91024E99E069F89EF8F36EE`
- Poppler `pdfinfo`: 4 pages.
- Poppler `pdftoppm -png` produced pages 1 through 4 in `tmp/pdfs/quote-payment-schedule-repair-*.png`.

## Visual review blocker

Poppler rendering completed (with non-fatal missing display-font notices for Symbol and ArialUnicode), but the required visual inspection tool could not open the PNGs because the Windows filesystem sandbox helper failed with `helper_unknown_error: setup refresh had errors`. The generated pages remain available locally for review.
## Review follow-up (2026-08-30)

- Allocated quote numbers now flow through the quote PDF input; the generated input drives its reference, filename, and email subject/reference. The legacy fallback remains only when allocation produces no number.
- Payment schedule rows are measured from their wrapped descriptions before drawing. Rows move as a whole before the footer area, and each continuation repeats `PAYMENT SCHEDULE CONTINUED` plus `DESCRIPTION`, `PERCENT`, `AMOUNT`, and `DUE DATE`.
- `splitText` now uses binary width-based splitting for long unbroken tokens; each emitted segment fits its specified column width.
- Focused tests: `npx --yes deno test --allow-env --allow-net supabase/functions/order-document/pdf.test.ts supabase/functions/order-document/index.test.ts`: PASS (7 tests).
- `npx --yes deno check supabase/functions/order-document/index.ts`: PASS.
- Updated fixture SHA-256: `CCBF34E6FFD928951B21000D2B4CE5DD0002FF5A6CF9DA5C04DA45AE9E1FEE8E`; Poppler rendered 5 pages to `tmp/pdfs/quote-payment-schedule-review-final-*.png`.
- The same visual-tool blocker remains: rendering completed, but the inspection tool could not open a PNG because the Windows sandbox helper reported `helper_unknown_error: setup refresh had errors`. Poppler again reported non-fatal missing display fonts for Symbol and ArialUnicode.
## Schedule pagination correction (2026-08-30)

The earlier follow-up report overstated the schedule fix: the live renderer still used a fixed `y -= 20` row advance and did not repeat the schedule columns on continuation pages. This correction replaces that code path with `drawScheduleHeader`, measures each wrapped description before drawing, reserves `footerSafetyY = 112`, and advances by the measured row height. Each continuation page draws `PAYMENT SCHEDULE CONTINUED` (or its invoice equivalent) plus `DESCRIPTION`, `PERCENT`, `AMOUNT`, and `DUE DATE`.

- Per-page PDF-content regression decodes each continuation page and requires all four schedule-only headers there; it also verifies all 20 long schedule descriptions.
- `npx --yes deno test --allow-env --allow-net supabase/functions/order-document/pdf.test.ts supabase/functions/order-document/index.test.ts`: PASS (7 tests).
- `npx --yes deno check supabase/functions/order-document/index.ts`: PASS.
- Corrected fixture SHA-256: `E22D69CC419AF9960BB7FE4CFA0E8F04D3BB23D6836AB268C4307D8CC6BD7584`; Poppler rendered 5 pages.
- Visual inspection remains blocked by `helper_unknown_error: setup refresh had errors` when opening rendered PNGs. Poppler completed with its non-fatal Symbol/ArialUnicode display-font notices.