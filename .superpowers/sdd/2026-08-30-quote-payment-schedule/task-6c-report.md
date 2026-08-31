# Task 6C PDF remediation report

## Implemented

- Stream a single page-tall item description across safe page segments. Every continuation repeats the item-table header and the item's quantity, rate, and amount, while reserving the footer area.
- Apply the confirmed IKKO PDF palette exactly: Ink #232220, Paper #f8f6f2, White #ffffff, Orange #ed6e3a, Muted #706b65, and Line #e3dfda.
- Continue using the public IKKO header-logo asset.
- Render studio phone, email, address, and an optional ABN in the footer on every generated page.
- Add studio.abn as an optional PDF input. The Edge Function reads it only from the explicit IKKO_HOMES_ABN deployment setting. No ABN was found in existing project settings/constants, so no value is fabricated and no ABN text is emitted until that setting is configured.

## Regression coverage

- A 220-token single item description must occupy at least three pages; every token, repeated continuation header, quantity, rate, and amount must remain present.
- Configured studio contact and ABN content is asserted from generated PDF streams.
- The generated PDF graphics streams are asserted to contain all six exact approved RGB tokens.

## Verification

- Required PDF edit marker completed successfully before PDF authoring.
- Confirmed RED before implementation: the two new regressions failed because the old renderer neither streamed a page-tall item nor drew an ABN.
- npx --yes deno check supabase/functions/order-document/pdf.ts supabase/functions/order-document/index.ts passed.
- npx --yes deno test --allow-env --allow-net supabase/functions/order-document/pdf.test.ts passed: 10/10.
- git diff --check passed.
- A temporary page-tall-item fixture rendered successfully with Poppler to three A4 PNG pages. Poppler emitted non-fatal missing display-font messages for Symbol and ArialUnicode.
- Interactive PNG visual inspection was blocked by the workspace image helper (windows sandbox helper setup refresh error). The generated three-page count, complete text/content regressions, and exact graphics operators were verified programmatically instead.

No deployment, push, or main-branch changes were performed.
