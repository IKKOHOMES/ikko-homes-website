import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOrderPdf,
  filenameForOrderDocument,
  SCHEDULE_CONTENT_START_Y,
  SCHEDULE_FOOTER_SAFETY_Y,
  scheduleHeaderLayout,
  scheduleRowHeight,
  scheduleSegmentLineCapacity,
  splitText,
} from "./pdf.ts";
async function extractPdfText(document: PDFDocument) {
  const context = document.context as unknown as {
    enumerateIndirectObjects(): Iterable<
      [unknown, { getContents?: () => Uint8Array }]
    >;
  };
  const streams = [...context.enumerateIndirectObjects()].flatMap(
    ([, object]) => {
      const contents = object.getContents?.();
      return contents ? [contents] : [];
    },
  );
  const decoded = await Promise.all(streams.map(async (contents) => {
    try {
      const stream = new Blob([
        contents.buffer.slice(
          contents.byteOffset,
          contents.byteOffset + contents.byteLength,
        ) as ArrayBuffer,
      ]).stream().pipeThrough(
        new DecompressionStream("deflate"),
      );
      return new TextDecoder("latin1").decode(
        await new Response(stream).arrayBuffer(),
      );
    } catch {
      return new TextDecoder("latin1").decode(contents);
    }
  }));
  return decoded.join("\n").replace(
    /<([0-9A-F]+)>/g,
    (_, hex: string) =>
      new TextDecoder("latin1").decode(
        Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => parseInt(pair, 16)),
      ),
  );
}

async function extractPdfPageText(document: PDFDocument) {
  const context = document.context as unknown as {
    lookup(reference: unknown): { getContents?: () => Uint8Array };
  };
  return await Promise.all(
    document.getPages().map(async (page) => {
      const contents = (page.node as unknown as {
        Contents(): { asArray(): unknown[] };
      }).Contents().asArray().flatMap((reference) => {
        const bytes = context.lookup(reference).getContents?.();
        return bytes ? [bytes] : [];
      });
      const decoded = await Promise.all(contents.map(async (bytes) => {
        const stream = new Blob([
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
        ]).stream().pipeThrough(new DecompressionStream("deflate"));
        return new TextDecoder("latin1").decode(
          await new Response(stream).arrayBuffer(),
        );
      }));
      return decoded.join("\n").replace(
        /<([0-9A-F]+)>/g,
        (_, hex: string) =>
          new TextDecoder("latin1").decode(
            Uint8Array.from(
              hex.match(/.{2}/g) ?? [],
              (pair) => parseInt(pair, 16),
            ),
          ),
      );
    }),
  );
}
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
  const text = await extractPdfText(document);
  assert(result.bytes.byteLength > 4_000);
  assert(document.getPageCount() >= 2);
  for (let index = 1; index <= 36; index++) {
    assert(text.includes(`Custom joinery package ${index}`));
  }
  assert(text.includes("ITEMS CONTINUED"));
});

Deno.test("splits an unbroken wide token to the available PDF column width", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const width = 120;
  const segments = splitText("W".repeat(120), font, 9, width);
  assert(segments.length > 1);
  for (const segment of segments) {
    assert(font.widthOfTextAtSize(segment, 9) <= width);
  }
});

Deno.test("paginates wrapped schedule rows with repeated headers and preserves financial fields", async () => {
  Deno.env.set("SUPABASE_URL", "https://jryybnersfuhaloxkhov.supabase.co");
  const result = await buildOrderPdf({
    documentType: "quote",
    number: "IKKO2026080100",
    issuedOn: "2026-08-30",
    customer: {
      name: "Schedule Customer",
      email: "schedule@example.com",
      phone: "0400 000 000",
      address: "69 Patricia Loop",
    },
    studio: {
      address: "69 Patricia Loop",
      email: "accounts@ikkohomes.com",
      phone: "0490 384 021",
    },
    lines: [{ description: "Joinery package", quantity: 1, unitPrice: 1000 }],
    subtotal: 1000,
    discountTotal: 100,
    gstTotal: 90,
    totalDue: 990,
    paymentSchedule: Array.from({ length: 20 }, (_, index) => ({
      description: `Schedule milestone ${
        index + 1
      } with a deliberately detailed description that wraps across the description column`,
      percentage: 5,
      amount: 49.5,
      dueOn: "2026-09-15",
    })),
  });
  const document = await PDFDocument.load(result.bytes);
  const text = await extractPdfText(document);
  assert(document.getPageCount() >= 2);
  for (let index = 1; index <= 20; index++) {
    assert(text.includes(`Schedule milestone ${index}`));
  }
  const pages = await extractPdfPageText(document);
  const continuationPages = pages.filter((page) =>
    page.includes("PAYMENT SCHEDULE CONTINUED")
  );
  assert(continuationPages.length >= 1);
  for (const page of continuationPages) {
    for (const header of ["DESCRIPTION", "PERCENT", "AMOUNT", "DUE DATE"]) {
      assert(page.includes(header));
    }
    assert(page.includes("15 Sept 2026"));
  }
  assert(text.includes("Subtotal"));
  assert(text.includes("Discount"));
  assert(text.includes("GST (10%)"));
  assert(text.includes("Total due"));
});

Deno.test("renders invoice milestone fields alongside the financial summary", async () => {
  Deno.env.set("SUPABASE_URL", "https://jryybnersfuhaloxkhov.supabase.co");
  const result = await buildOrderPdf({
    documentType: "invoice",
    number: "INV-1001",
    issuedOn: "2026-08-30",
    dueOn: "2026-09-15",
    customer: {
      name: "Invoice Customer",
      email: "invoice@example.com",
      phone: "0400 000 000",
      address: "69 Patricia Loop",
    },
    studio: {
      address: "69 Patricia Loop",
      email: "accounts@ikkohomes.com",
      phone: "0490 384 021",
    },
    lines: [{ description: "Final joinery", quantity: 1, unitPrice: 1100 }],
    subtotal: 1000,
    discountTotal: 0,
    gstTotal: 100,
    totalDue: 1100,
    invoiceMilestone: {
      description: "Final completion",
      percentage: 100,
      amount: 1100,
      dueOn: "2026-09-15",
    },
  });
  const text = await extractPdfText(await PDFDocument.load(result.bytes));
  for (
    const value of [
      "Subtotal",
      "Discount",
      "GST (10%)",
      "Total due",
      "INVOICE MILESTONE",
      "Final completion",
      "100%",
      "15 Sept 2026",
    ]
  ) {
    assert(text.includes(value));
  }
});

Deno.test("streams a schedule description taller than a page without footer collision", async () => {
  Deno.env.set("SUPABASE_URL", "https://jryybnersfuhaloxkhov.supabase.co");
  const tokens = Array.from(
    { length: 180 },
    (_, index) => `TallScheduleToken${String(index + 1).padStart(3, "0")}`,
  );
  const result = await buildOrderPdf({
    documentType: "quote",
    number: "IKKO2026080101",
    issuedOn: "2026-08-30",
    customer: {
      name: "Tall Row Customer",
      email: "tall@example.com",
      phone: "0400 000 000",
      address: "69 Patricia Loop",
    },
    studio: {
      address: "69 Patricia Loop",
      email: "accounts@ikkohomes.com",
      phone: "0490 384 021",
    },
    lines: [{ description: "Joinery package", quantity: 1, unitPrice: 1000 }],
    subtotal: 1000,
    discountTotal: 0,
    gstTotal: 100,
    totalDue: 1100,
    paymentSchedule: [{
      description: tokens.join(" "),
      percentage: 100,
      amount: 1100,
      dueOn: "2026-09-15",
    }],
  });
  const document = await PDFDocument.load(result.bytes);
  const text = await extractPdfText(document);
  const pages = await extractPdfPageText(document);
  assert(document.getPageCount() >= 3);
  for (const token of tokens) assert(text.includes(token));
  const continuationPages = pages.filter((page) =>
    page.includes("PAYMENT SCHEDULE CONTINUED")
  );
  assert(continuationPages.length >= 2);
  for (const page of continuationPages) {
    for (const header of ["DESCRIPTION", "PERCENT", "AMOUNT", "DUE DATE"]) {
      assert(page.includes(header));
    }
    assert(page.includes("15 Sept 2026"));
    assert(page.includes("100%"));
    assert(page.includes("$1,100.00"));
  }
});

Deno.test("keeps every tall schedule segment above the footer safety boundary", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const descriptionLines = splitText(
    Array.from(
      { length: 180 },
      (_, index) => `TallScheduleToken${String(index + 1).padStart(3, "0")}`,
    ).join(" "),
    font,
    8.5,
    245,
  );
  const continuationY = scheduleHeaderLayout(SCHEDULE_CONTENT_START_Y).nextY;
  let y = continuationY;
  let remaining = [...descriptionLines];
  let segments = 0;
  while (remaining.length) {
    if (y - scheduleRowHeight(remaining.length) < SCHEDULE_FOOTER_SAFETY_Y) {
      y = continuationY;
    }
    const capacity = scheduleSegmentLineCapacity(y);
    assert(capacity >= 1);
    const segment = remaining.splice(0, capacity);
    const drawStartY = y;
    const drawEndY = y - scheduleRowHeight(segment.length);
    assert(drawStartY >= SCHEDULE_FOOTER_SAFETY_Y);
    assert(drawEndY >= SCHEDULE_FOOTER_SAFETY_Y);
    y = drawEndY;
    segments++;
  }
  assert(segments >= 2);
});
