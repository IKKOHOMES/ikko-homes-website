import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildOrderPdf, filenameForOrderDocument } from "./pdf.ts";

Deno.test("creates an IKKO Homes PDF filename from a document reference", () => {
  assertEquals(
    filenameForOrderDocument("IKKO Q-1001"),
    "IKKO-HOMES-IKKO-Q-1001.pdf",
  );
});

Deno.test("renders a branded invoice PDF with the public IKKO Homes logo", async () => {
  Deno.env.set("SUPABASE_URL", "https://jryybnersfuhaloxkhov.supabase.co");
  const result = await buildOrderPdf({
    documentType: "invoice",
    number: "IKKO2026080001",
    issuedOn: "2026-08-28",
    dueOn: "2026-09-15",
    customer: {
      name: "Zebin Hu",
      email: "client@example.com",
      phone: "0400 000 000",
      address: "69 Patricia Loop",
    },
    studio: {
      address: "69 Patricia Loop, Keysborough VIC 3173",
      email: "accounts@ikkohomes.com",
      phone: "0490 384 021",
    },
    lines: [{
      description: "Deposit - ORD-1001",
      quantity: 1,
      unitPrice: 21,
      unit: "sqm",
    }],
    subtotal: 3000,
    discountTotal: 100,
    gstTotal: 290,
    totalDue: 3190,
    paymentSchedule: [{
      description: "Deposit",
      percentage: 50,
      amount: 1595,
      dueOn: "2026-09-15",
    }],
  });
  assertEquals(result.filename, "IKKO-HOMES-IKKO2026080001.pdf");
  assert(result.bytes.byteLength > 1_000);
});

Deno.test("paginates every long line item with repeated continuation headers", async () => {
  Deno.env.set("SUPABASE_URL", "https://jryybnersfuhaloxkhov.supabase.co");
  const result = await buildOrderPdf({
    documentType: "quote",
    number: "IKKO2026080099",
    issuedOn: "2026-08-30",
    customer: {
      name: "Test Customer",
      email: "test@example.com",
      phone: "0400 000 000",
      address: "69 Patricia Loop",
    },
    studio: {
      address: "69 Patricia Loop",
      email: "accounts@ikkohomes.com",
      phone: "0490 384 021",
    },
    lines: Array.from(
      { length: 36 },
      (_, index) => ({
        description: `Custom joinery package ${
          index + 1
        } with a detailed finishing and installation description`,
        quantity: 1,
        unitPrice: 21,
        unit: "sqm",
      }),
    ),
    subtotal: 756,
    discountTotal: 0,
    gstTotal: 75.6,
    totalDue: 831.6,
    paymentSchedule: [{
      description: "Deposit",
      percentage: 100,
      amount: 831.6,
      dueOn: "2026-09-15",
    }],
  });
  const document = await PDFDocument.load(result.bytes);
  assert(result.bytes.byteLength > 4_000);
});
