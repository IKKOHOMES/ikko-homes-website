import { hasExactTotal } from './money';

export type PaymentPlanDraft = { id?: string; label: string; amount: number; dueOn: string; internalNote: string };
export type PaymentPlanValidation = { valid: true } | { valid: false; message: string };

export function validatePaymentPlan(instalments: PaymentPlanDraft[], quoteTotal: number): PaymentPlanValidation {
  if (!instalments.length) return { valid: false, message: 'Add at least one instalment.' };
  if (instalments.some((line) => !line.label.trim() || !Number.isFinite(line.amount) || line.amount <= 0 || !line.dueOn)) return { valid: false, message: 'Every instalment needs a name, amount and due date.' };
  return hasExactTotal(instalments.map((line) => line.amount), quoteTotal)
    ? { valid: true }
    : { valid: false, message: `Instalments must total $${quoteTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` };
}
