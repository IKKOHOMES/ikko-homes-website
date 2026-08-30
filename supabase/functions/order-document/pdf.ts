import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "https://esm.sh/pdf-lib@1.17.1";

export type OrderPdfLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string | null;
  isTbd?: boolean;
  finish?: string | null;
};
export type OrderPdfPlanLine = {
  description: string;
  percentage: number;
  amount: number;
  dueOn: string;
  status?: string;
};
export type OrderPdfInput = {
  documentType: "quote" | "invoice";
  number: string;
  issuedOn: string;
  expiresOn?: string | null;
  dueOn?: string | null;
  customer: { name: string; email: string; phone: string; address: string };
  studio: { address: string; email: string; phone: string };
  lines: OrderPdfLine[];
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  totalDue: number;
  paymentSchedule?: OrderPdfPlanLine[];
  invoiceMilestone?: OrderPdfPlanLine | null;
  invoiceStatus?: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const charcoal = rgb(0.14, 0.13, 0.12);
const muted = rgb(0.37, 0.34, 0.31);
const orange = rgb(0.945, 0.35, 0.212);
const cream = rgb(0.969, 0.957, 0.937);
const white = rgb(1, 1, 1);
const logoPath = "site-assets/brand/ikko-logo-header.png";

export function filenameForOrderDocument(reference: string) {
  const safeReference =
    reference.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") ||
    "document";
  return `IKKO-HOMES-${safeReference}.pdf`;
}

const amount = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    value,
  );
const humanDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(
      new Date(`${value.slice(0, 10)}T12:00:00`),
    )
    : "-";
const lineAmount = (line: OrderPdfLine) =>
  line.isTbd ? "T.B.D." : amount(line.unitPrice * line.quantity);

async function embedBrandLogo(pdf: PDFDocument) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Unable to generate the PDF document.");
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/public/${logoPath}`,
  );
  if (!response.ok) throw new Error("Unable to generate the PDF document.");
  return pdf.embedPng(await response.arrayBuffer());
}

export function splitText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
) {
  const splitWord = (word: string) => {
    const chunks: string[] = [];
    let remainder = word;
    while (remainder && font.widthOfTextAtSize(remainder, size) > width) {
      let low = 1;
      let high = remainder.length;
      while (low < high) {
        const midpoint = Math.ceil((low + high) / 2);
        if (
          font.widthOfTextAtSize(remainder.slice(0, midpoint), size) <= width
        ) {
          low = midpoint;
        } else {
          high = midpoint - 1;
        }
      }
      chunks.push(remainder.slice(0, low));
      remainder = remainder.slice(low);
    }
    if (remainder) chunks.push(remainder);
    return chunks;
  };
  const words = text.replace(/\s+/g, " ").trim().split(" ").flatMap(splitWord)
    .filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
function drawWrapped(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  },
) {
  const lines = splitText(text, options.font, options.size, options.width);
  const lineHeight = options.lineHeight ?? options.size * 1.35;
  lines.forEach((line, index) =>
    page.drawText(line, {
      x: options.x,
      y: options.y - index * lineHeight,
      size: options.size,
      font: options.font,
      color: options.color ?? charcoal,
    })
  );
  return options.y - lines.length * lineHeight;
}

export async function buildOrderPdf(
  input: OrderPdfInput,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedBrandLogo(pdf);
  const isQuote = input.documentType === "quote";
  const documentTitle = isQuote ? "Quote" : "Invoice";

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: cream,
  });
  const logoScale = Math.min(112 / logo.width, 39 / logo.height);
  page.drawImage(logo, {
    x: MARGIN,
    y: PAGE_HEIGHT - 79,
    width: logo.width * logoScale,
    height: logo.height * logoScale,
  });
  page.drawText("INTERIORS, FURNITURE AND JOINERY", {
    x: MARGIN,
    y: PAGE_HEIGHT - 88,
    size: 6.5,
    font: bold,
    color: orange,
  });
  const titleWidth = serif.widthOfTextAtSize(documentTitle, 31);
  page.drawText(documentTitle, {
    x: PAGE_WIDTH - MARGIN - titleWidth,
    y: PAGE_HEIGHT - 63,
    size: 31,
    font: serif,
    color: charcoal,
  });
  const referenceWidth = bold.widthOfTextAtSize(input.number, 9);
  page.drawText(input.number, {
    x: PAGE_WIDTH - MARGIN - referenceWidth,
    y: PAGE_HEIGHT - 82,
    size: 9,
    font: bold,
    color: orange,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 98 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 98 },
    thickness: 1,
    color: orange,
  });

  let customerY = PAGE_HEIGHT - 129;
  page.drawText("BILL TO", {
    x: MARGIN,
    y: customerY,
    size: 8,
    font: bold,
    color: orange,
  });
  customerY -= 18;
  customerY = drawWrapped(page, input.customer.name, {
    x: MARGIN,
    y: customerY,
    width: 230,
    size: 11,
    font: bold,
  });
  customerY = drawWrapped(page, input.customer.address, {
    x: MARGIN,
    y: customerY - 2,
    width: 230,
    size: 9,
    font: sans,
    color: muted,
  });
  customerY = drawWrapped(page, input.customer.email, {
    x: MARGIN,
    y: customerY - 2,
    width: 230,
    size: 9,
    font: sans,
    color: muted,
  });
  drawWrapped(page, input.customer.phone, {
    x: MARGIN,
    y: customerY - 2,
    width: 230,
    size: 9,
    font: sans,
    color: muted,
  });

  const metaX = 370;
  const meta = [
    ["Issue date", humanDate(input.issuedOn)],
    [
      isQuote ? "Valid until" : "Due date",
      humanDate(isQuote ? input.expiresOn : input.dueOn),
    ],
    ["Reference", input.number],
  ];
  meta.forEach(([label, value], index) => {
    const y = PAGE_HEIGHT - 145 - index * 22;
    page.drawText(label, { x: metaX, y, size: 8, font: sans, color: muted });
    const width = bold.widthOfTextAtSize(value, 9);
    page.drawText(value, {
      x: PAGE_WIDTH - MARGIN - width,
      y: y - 1,
      size: 9,
      font: bold,
      color: charcoal,
    });
  });

  const summaryY = PAGE_HEIGHT - 254;
  const summaryCells = [
    { label: "REFERENCE", value: input.number, color: orange },
    {
      label: isQuote ? "VALID UNTIL" : "DUE DATE",
      value: humanDate(isQuote ? input.expiresOn : input.dueOn),
      color: orange,
    },
    { label: "TOTAL (AUD)", value: amount(input.totalDue), color: charcoal },
  ];
  const cellWidth = (PAGE_WIDTH - MARGIN * 2) / summaryCells.length;
  summaryCells.forEach((cell, index) => {
    const x = MARGIN + index * cellWidth;
    page.drawRectangle({
      x,
      y: summaryY - 53,
      width: cellWidth - (index === summaryCells.length - 1 ? 0 : 1),
      height: 53,
      color: cell.color,
    });
    page.drawText(cell.label, {
      x: x + 11,
      y: summaryY - 18,
      size: 6.5,
      font: bold,
      color: white,
    });
    page.drawText(cell.value, {
      x: x + 11,
      y: summaryY - 38,
      size: index === 2 ? 16 : 11,
      font: bold,
      color: white,
    });
  });

  let y = summaryY - 84;
  const columns = {
    description: MARGIN + 28,
    quantity: 345,
    price: 412,
    total: 505,
  };
  page.drawRectangle({
    x: MARGIN,
    y: y - 15,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 22,
    color: charcoal,
  });
  page.drawText("#", {
    x: MARGIN + 8,
    y: y - 7,
    size: 7.5,
    font: bold,
    color: white,
  });
  page.drawText("ITEM & DESCRIPTION", {
    x: columns.description,
    y: y - 7,
    size: 7.5,
    font: bold,
    color: white,
  });
  page.drawText("QUANTITY", {
    x: columns.quantity,
    y: y - 7,
    size: 7.5,
    font: bold,
    color: white,
  });
  page.drawText("RATE", {
    x: columns.price,
    y: y - 7,
    size: 7.5,
    font: bold,
    color: white,
  });
  page.drawText("AMOUNT", {
    x: columns.total,
    y: y - 7,
    size: 7.5,
    font: bold,
    color: white,
  });
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.7,
    color: muted,
  });
  y -= 18;
  for (const [lineIndex, line] of input.lines.entries()) {
    const description = line.finish
      ? `${line.description} - ${line.finish}`
      : line.description;
    const wrapped = splitText(description, sans, 9, 260);
    const rowHeight = Math.max(24, wrapped.length * 11 + 13);

    // Keep a complete row together and carry every remaining item to a
    // continuation page. There is deliberately no item-count limit here.
    if (y - rowHeight < 165) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        color: cream,
      });
      page.drawImage(logo, {
        x: MARGIN,
        y: PAGE_HEIGHT - 79,
        width: logo.width * logoScale,
        height: logo.height * logoScale,
      });
      page.drawText("ITEMS CONTINUED", {
        x: MARGIN,
        y: PAGE_HEIGHT - 105,
        size: 7.5,
        font: bold,
        color: orange,
      });
      page.drawRectangle({
        x: MARGIN,
        y: PAGE_HEIGHT - 142,
        width: PAGE_WIDTH - MARGIN * 2,
        height: 22,
        color: charcoal,
      });
      ["#", "ITEM & DESCRIPTION", "QUANTITY", "RATE", "AMOUNT"].forEach((
        label,
        index,
      ) =>
        page.drawText(label, {
          x: [
            MARGIN + 8,
            columns.description,
            columns.quantity,
            columns.price,
            columns.total,
          ][index],
          y: PAGE_HEIGHT - 134,
          size: 7.5,
          font: bold,
          color: white,
        })
      );
      y = PAGE_HEIGHT - 160;
    }

    page.drawText(String(lineIndex + 1), {
      x: MARGIN + 8,
      y,
      size: 9,
      font: sans,
      color: muted,
    });
    wrapped.forEach((part, index) =>
      page.drawText(part, {
        x: columns.description,
        y: y - index * 11,
        size: 9,
        font: sans,
        color: charcoal,
      })
    );
    page.drawText(String(line.quantity), {
      x: columns.quantity + 4,
      y,
      size: 9,
      font: sans,
      color: charcoal,
    });
    const unitPrice = line.isTbd
      ? "T.B.D."
      : `${amount(line.unitPrice)}${line.unit ? ` / ${line.unit}` : ""}`;
    page.drawText(unitPrice, {
      x: columns.price,
      y,
      size: 8.5,
      font: sans,
      color: line.isTbd ? orange : charcoal,
    });
    page.drawText(lineAmount(line), {
      x: columns.total,
      y,
      size: 8.5,
      font: bold,
      color: line.isTbd ? orange : charcoal,
    });
    y -= rowHeight;
  }
  const newContentPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: cream,
    });
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - 79,
      width: logo.width * logoScale,
      height: logo.height * logoScale,
    });
    page.drawText(documentTitle, {
      x: PAGE_WIDTH - MARGIN - titleWidth,
      y: PAGE_HEIGHT - 63,
      size: 31,
      font: serif,
      color: charcoal,
    });
    page.drawText(input.number, {
      x: PAGE_WIDTH - MARGIN - referenceWidth,
      y: PAGE_HEIGHT - 82,
      size: 9,
      font: bold,
      color: charcoal,
    });
    y = PAGE_HEIGHT - 135;
  };
  if (y < 255) newContentPage();
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.7,
    color: muted,
  });
  y -= 21;
  const totals = [
    ["Subtotal", amount(input.subtotal)],
    [
      "Discount",
      input.discountTotal ? `-${amount(input.discountTotal)}` : amount(0),
    ],
    ["GST (10%)", amount(input.gstTotal)],
    ["Total due", amount(input.totalDue)],
  ];
  totals.forEach(([label, value], index) => {
    const yy = y - index * 20;
    if (index === 3) {
      page.drawRectangle({
        x: 375,
        y: yy - 7,
        width: 178,
        height: 23,
        color: orange,
      });
    }
    page.drawText(label, {
      x: 395,
      y: yy,
      size: index === 3 ? 9 : 8.5,
      font: index === 3 ? bold : sans,
      color: index === 3 ? white : muted,
    });
    page.drawText(value, {
      x: 505,
      y: yy,
      size: index === 3 ? 10 : 9,
      font: bold,
      color: index === 3 ? white : charcoal,
    });
  });
  y -= 102;
  const schedule = isQuote
    ? input.paymentSchedule
    : (input.invoiceMilestone ? [input.invoiceMilestone] : []);
  if (schedule?.length) {
    if (y < 120) newContentPage();
    page.drawText(isQuote ? "PAYMENT SCHEDULE" : "INVOICE MILESTONE", {
      x: MARGIN,
      y,
      size: 7.5,
      font: bold,
      color: orange,
    });
    y -= 16;
    ["DESCRIPTION", "PERCENT", "AMOUNT", "DUE DATE"].forEach((label, index) =>
      page.drawText(label, {
        x: [MARGIN, 300, 390, 485][index],
        y,
        size: 7,
        font: bold,
        color: muted,
      })
    );
    y -= 15;
    schedule.forEach((item) => {
      if (y < 100) {
        newContentPage();
        page.drawText(
          isQuote ? "PAYMENT SCHEDULE CONTINUED" : "INVOICE MILESTONE",
          { x: MARGIN, y, size: 7.5, font: bold, color: orange },
        );
        y -= 22;
      }
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: .5,
        color: muted,
      });
      y -= 13;
      drawWrapped(page, item.description, {
        x: MARGIN,
        y,
        width: 245,
        size: 8.5,
        font: sans,
      });
      page.drawText(`${item.percentage}%`, {
        x: 300,
        y,
        size: 8.5,
        font: sans,
      });
      page.drawText(amount(item.amount), { x: 390, y, size: 8.5, font: bold });
      page.drawText(humanDate(item.dueOn), {
        x: 485,
        y,
        size: 7.5,
        font: sans,
      });
      y -= 20;
    });
  }
  const note = isQuote
    ? "This quote is prepared for your review. Please contact our studio to confirm before invoices are issued."
    : input.invoiceStatus === "paid"
    ? "Payment received with thanks."
    : "Please refer to the due date above when arranging payment.";
  drawWrapped(page, note, {
    x: MARGIN,
    y,
    width: PAGE_WIDTH - MARGIN * 2,
    size: 8.5,
    font: sans,
    color: muted,
    lineHeight: 12,
  });
  page.drawLine({
    start: { x: MARGIN, y: 72 },
    end: { x: PAGE_WIDTH - MARGIN, y: 72 },
    thickness: 0.7,
    color: muted,
  });
  page.drawText(input.studio.phone, {
    x: MARGIN,
    y: 56,
    size: 7.5,
    font: sans,
    color: charcoal,
  });
  const emailWidth = sans.widthOfTextAtSize(input.studio.email, 7.5);
  page.drawText(input.studio.email, {
    x: (PAGE_WIDTH - emailWidth) / 2,
    y: 56,
    size: 7.5,
    font: sans,
    color: charcoal,
  });
  const addressWidth = sans.widthOfTextAtSize(input.studio.address, 7.5);
  page.drawText(input.studio.address, {
    x: PAGE_WIDTH - MARGIN - addressWidth,
    y: 56,
    size: 7.5,
    font: sans,
    color: charcoal,
  });

  return {
    bytes: await pdf.save(),
    filename: filenameForOrderDocument(input.number),
  };
}
