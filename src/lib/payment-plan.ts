import { fromCents, hasExactTotal, toCents } from './money';

export type PaymentPlanDraft = { id?: string; label: string; percentage: number; amount: number; dueOn: string; internalNote: string };
export type PaymentPlanValidation = { valid: true } | { valid: false; message: string };
type QuoteLine = { quantity: number; unitPrice: number };

function roundPercentage(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function requireScheduleEdit(lines: PaymentPlanDraft[], index: number, value: number, quoteTotal: number) {
  if (!Number.isInteger(index) || index < 0 || index >= lines.length || !Number.isFinite(value) || value < 0 || !Number.isFinite(quoteTotal) || quoteTotal <= 0) throw new Error('Enter a valid non-negative payment value.');
}
function balanceFinalLine(lines: PaymentPlanDraft[], index: number, quoteTotal: number): PaymentPlanDraft[] {
  const finalIndex = lines.length - 1;
  if (!lines.length) return lines;
  const quoteCents = toCents(quoteTotal);
  const otherCents = lines.reduce((sum, line, lineIndex) => lineIndex === finalIndex ? sum : sum + toCents(line.amount), 0);
  const finalAmount = fromCents(quoteCents - otherCents);
  if (finalAmount < 0) throw new Error('Payment instalments cannot exceed the quote total.');
  const next = lines.map((line) => ({ ...line }));
  next[finalIndex] = { ...next[finalIndex], amount: finalAmount, percentage: roundPercentage((toCents(finalAmount) / quoteCents) * 100) };
  return next;
}

export function calculateQuoteTotals(lines: QuoteLine[], discountTotal: number) {
  if (!Number.isFinite(discountTotal) || discountTotal < 0 || lines.some((line) => !Number.isFinite(line.quantity) || !Number.isFinite(line.unitPrice) || line.quantity < 0 || line.unitPrice < 0)) throw new Error('Quote totals require non-negative finite values.');
  const subtotalCents = lines.reduce((sum, line) => sum + toCents(line.quantity * line.unitPrice), 0);
  const discountCents = toCents(discountTotal);
  const gstCents = Math.round((subtotalCents - discountCents) * 0.10);
  return { subtotal: fromCents(subtotalCents), discountTotal: fromCents(discountCents), gstTotal: fromCents(gstCents), total: fromCents(subtotalCents - discountCents + gstCents) };
}

export function updateSchedulePercent(lines: PaymentPlanDraft[], index: number, percentage: number, quoteTotal: number): PaymentPlanDraft[] {
  requireScheduleEdit(lines, index, percentage, quoteTotal);
  const amountCents = Math.round(toCents(quoteTotal) * percentage / 100);
  const canonicalPercentage = roundPercentage((amountCents / toCents(quoteTotal)) * 100);
  const next = lines.map((line, lineIndex) => lineIndex === index ? { ...line, percentage: canonicalPercentage, amount: fromCents(amountCents) } : { ...line });
  return balanceFinalLine(next, index, quoteTotal);
}

export function updateScheduleAmount(lines: PaymentPlanDraft[], index: number, amount: number, quoteTotal: number): PaymentPlanDraft[] {
  requireScheduleEdit(lines, index, amount, quoteTotal);
  const amountCents = toCents(amount); const quoteCents = toCents(quoteTotal);
  const next = lines.map((line, lineIndex) => lineIndex === index ? { ...line, amount: fromCents(amountCents), percentage: roundPercentage((amountCents / quoteCents) * 100) } : { ...line });
  return balanceFinalLine(next, index, quoteTotal);
}

export function validatePaymentPlan(instalments: PaymentPlanDraft[], quoteTotal: number): PaymentPlanValidation {
  if (!instalments.length) return { valid: false, message: 'Add at least one instalment.' };
  if (instalments.some((line) => !line.label.trim() || !Number.isFinite(line.percentage) || line.percentage <= 0 || !Number.isFinite(line.amount) || line.amount <= 0 || !line.dueOn)) return { valid: false, message: 'Every instalment needs a name, percentage, amount and due date.' };
  if (Math.abs(instalments.reduce((sum, line) => sum + toCents(line.percentage), 0) - 10000) > 1) return { valid: false, message: 'Instalment percentages must total 100%.' };
  return hasExactTotal(instalments.map((line) => line.amount), quoteTotal)
    ? { valid: true }
    : { valid: false, message: `Instalments must total $${quoteTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` };
}
