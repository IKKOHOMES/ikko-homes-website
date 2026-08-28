import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'https://esm.sh/pdf-lib@1.17.1';

export type OrderPdfLine = { description: string; quantity: number; unitPrice: number; isTbd?: boolean; finish?: string | null };
export type OrderPdfPlanLine = { label: string; amount: number; dueOn: string; status?: string };
export type OrderPdfInput = {
  documentType: 'quote' | 'invoice';
  reference: string;
  issuedOn: string;
  expiresOn?: string | null;
  dueOn?: string | null;
  customer: { name: string; email: string; phone: string; address: string };
  studio: { address: string; email: string; phone: string };
  lines: OrderPdfLine[];
  total: number;
  paymentPlan?: OrderPdfPlanLine[];
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
const logoPath = 'site-assets/brand/ikko-logo-header.png';

export function filenameForOrderDocument(reference: string) {
  const safeReference = reference.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'document';
  return `IKKO-HOMES-${safeReference}.pdf`;
}

const amount = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
const humanDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '-';
const lineAmount = (line: OrderPdfLine) => line.isTbd ? 'T.B.D.' : amount(line.unitPrice * line.quantity);

async function embedBrandLogo(pdf: PDFDocument) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Unable to generate the PDF document.');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/public/${logoPath}`);
  if (!response.ok) throw new Error('Unable to generate the PDF document.');
  return pdf.embedPng(await response.arrayBuffer());
}

function splitText(text: string, font: PDFFont, size: number, width: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = []; let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawWrapped(page: PDFPage, text: string, options: { x: number; y: number; width: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb>; lineHeight?: number }) {
  const lines = splitText(text, options.font, options.size, options.width);
  const lineHeight = options.lineHeight ?? options.size * 1.35;
  lines.forEach((line, index) => page.drawText(line, { x: options.x, y: options.y - index * lineHeight, size: options.size, font: options.font, color: options.color ?? charcoal }));
  return options.y - lines.length * lineHeight;
}

export async function buildOrderPdf(input: OrderPdfInput): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedBrandLogo(pdf);
  const isQuote = input.documentType === 'quote';
  const documentTitle = isQuote ? 'Quote' : 'Invoice';

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: cream });
  const logoScale = Math.min(112 / logo.width, 39 / logo.height);
  page.drawImage(logo, { x: MARGIN, y: PAGE_HEIGHT - 79, width: logo.width * logoScale, height: logo.height * logoScale });
  page.drawText('INTERIORS, FURNITURE AND JOINERY', { x: MARGIN, y: PAGE_HEIGHT - 88, size: 6.5, font: bold, color: orange });
  const titleWidth = serif.widthOfTextAtSize(documentTitle, 31);
  page.drawText(documentTitle, { x: PAGE_WIDTH - MARGIN - titleWidth, y: PAGE_HEIGHT - 63, size: 31, font: serif, color: charcoal });
  const referenceWidth = bold.widthOfTextAtSize(input.reference, 9);
  page.drawText(input.reference, { x: PAGE_WIDTH - MARGIN - referenceWidth, y: PAGE_HEIGHT - 82, size: 9, font: bold, color: orange });
  page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 98 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 98 }, thickness: 1, color: orange });

  let customerY = PAGE_HEIGHT - 129;
  page.drawText('BILL TO', { x: MARGIN, y: customerY, size: 8, font: bold, color: orange });
  customerY -= 18;
  customerY = drawWrapped(page, input.customer.name, { x: MARGIN, y: customerY, width: 230, size: 11, font: bold });
  customerY = drawWrapped(page, input.customer.address, { x: MARGIN, y: customerY - 2, width: 230, size: 9, font: sans, color: muted });
  customerY = drawWrapped(page, input.customer.email, { x: MARGIN, y: customerY - 2, width: 230, size: 9, font: sans, color: muted });
  drawWrapped(page, input.customer.phone, { x: MARGIN, y: customerY - 2, width: 230, size: 9, font: sans, color: muted });

  const metaX = 370;
  const meta = [
    ['Issue date', humanDate(input.issuedOn)],
    [isQuote ? 'Valid until' : 'Due date', humanDate(isQuote ? input.expiresOn : input.dueOn)],
    ['Reference', input.reference],
  ];
  meta.forEach(([label, value], index) => {
    const y = PAGE_HEIGHT - 145 - index * 22;
    page.drawText(label, { x: metaX, y, size: 8, font: sans, color: muted });
    const width = bold.widthOfTextAtSize(value, 9);
    page.drawText(value, { x: PAGE_WIDTH - MARGIN - width, y: y - 1, size: 9, font: bold, color: charcoal });
  });

  const summaryY = PAGE_HEIGHT - 254;
  const summaryCells = [
    { label: 'REFERENCE', value: input.reference, color: orange },
    { label: isQuote ? 'VALID UNTIL' : 'DUE DATE', value: humanDate(isQuote ? input.expiresOn : input.dueOn), color: orange },
    { label: 'TOTAL (AUD)', value: amount(input.total), color: charcoal },
  ];
  const cellWidth = (PAGE_WIDTH - MARGIN * 2) / summaryCells.length;
  summaryCells.forEach((cell, index) => {
    const x = MARGIN + index * cellWidth;
    page.drawRectangle({ x, y: summaryY - 53, width: cellWidth - (index === summaryCells.length - 1 ? 0 : 1), height: 53, color: cell.color });
    page.drawText(cell.label, { x: x + 11, y: summaryY - 18, size: 6.5, font: bold, color: white });
    page.drawText(cell.value, { x: x + 11, y: summaryY - 38, size: index === 2 ? 16 : 11, font: bold, color: white });
  });

  let y = summaryY - 84;
  const columns = { description: MARGIN, quantity: 345, price: 412, total: 505 };
  page.drawText('DESCRIPTION', { x: columns.description, y, size: 7.5, font: bold, color: orange });
  page.drawText('QTY', { x: columns.quantity, y, size: 7.5, font: bold, color: orange });
  page.drawText('UNIT PRICE', { x: columns.price, y, size: 7.5, font: bold, color: orange });
  page.drawText('AMOUNT', { x: columns.total, y, size: 7.5, font: bold, color: orange });
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.7, color: muted });
  y -= 18;
  input.lines.slice(0, 11).forEach((line) => {
    const description = line.finish ? `${line.description} - ${line.finish}` : line.description;
    const wrapped = splitText(description, sans, 9, 260);
    wrapped.slice(0, 2).forEach((part, index) => page.drawText(part, { x: columns.description, y: y - index * 11, size: 9, font: sans, color: charcoal }));
    page.drawText(String(line.quantity), { x: columns.quantity + 4, y, size: 9, font: sans, color: charcoal });
    const unitPrice = line.isTbd ? 'T.B.D.' : amount(line.unitPrice);
    page.drawText(unitPrice, { x: columns.price, y, size: 8.5, font: sans, color: line.isTbd ? orange : charcoal });
    page.drawText(lineAmount(line), { x: columns.total, y, size: 8.5, font: bold, color: line.isTbd ? orange : charcoal });
    y -= Math.max(24, wrapped.length * 11 + 13);
  });

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.7, color: muted });
  y -= 21;
  page.drawText('TOTAL (AUD)', { x: 395, y, size: 9, font: bold, color: charcoal });
  page.drawText(amount(input.total), { x: 505, y, size: 11, font: bold, color: charcoal });
  y -= 34;

  if (isQuote && input.paymentPlan?.length) {
    page.drawText('PROPOSED PAYMENT PLAN', { x: MARGIN, y, size: 7.5, font: bold, color: orange });
    y -= 16;
    input.paymentPlan.slice(0, 5).forEach((instalment) => {
      page.drawText(instalment.label, { x: MARGIN, y, size: 9, font: sans, color: charcoal });
      page.drawText(`Due ${humanDate(instalment.dueOn)}`, { x: 285, y, size: 8.5, font: sans, color: muted });
      page.drawText(amount(instalment.amount), { x: 505, y, size: 9, font: bold, color: charcoal });
      y -= 16;
    });
    y -= 9;
  }

  const note = isQuote
    ? 'This quote is prepared for your review. Please contact our studio to confirm before invoices are issued.'
    : input.invoiceStatus === 'paid' ? 'Payment received with thanks.' : 'Please refer to the due date above when arranging payment.';
  drawWrapped(page, note, { x: MARGIN, y, width: PAGE_WIDTH - MARGIN * 2, size: 8.5, font: sans, color: muted, lineHeight: 12 });
  page.drawLine({ start: { x: MARGIN, y: 72 }, end: { x: PAGE_WIDTH - MARGIN, y: 72 }, thickness: 0.7, color: muted });
  page.drawText(input.studio.phone, { x: MARGIN, y: 56, size: 7.5, font: sans, color: charcoal });
  const emailWidth = sans.widthOfTextAtSize(input.studio.email, 7.5);
  page.drawText(input.studio.email, { x: (PAGE_WIDTH - emailWidth) / 2, y: 56, size: 7.5, font: sans, color: charcoal });
  const addressWidth = sans.widthOfTextAtSize(input.studio.address, 7.5);
  page.drawText(input.studio.address, { x: PAGE_WIDTH - MARGIN - addressWidth, y: 56, size: 7.5, font: sans, color: charcoal });

  return { bytes: await pdf.save(), filename: filenameForOrderDocument(input.reference) };
}