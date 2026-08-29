import { expect, test } from 'vitest';
import { calculateQuoteTotals, updateScheduleAmount, updateSchedulePercent, validatePaymentPlan } from '../lib/payment-plan';

const depositAndFinal = [
  { label: 'Deposit', percentage: 50, amount: 0, dueOn: '2026-09-01', internalNote: '' },
  { label: 'Final', percentage: 50, amount: 0, dueOn: '2026-10-01', internalNote: '' },
];

test('calculates a discounted quote with 10 percent GST rounded to cents', () => {
  expect(calculateQuoteTotals([{ quantity: 2, unitPrice: 100 }], 20)).toEqual({
    subtotal: 200, discountTotal: 20, gstTotal: 18, total: 198,
  });
});

test('balances the final instalment after a percentage edit', () => {
  expect(updateSchedulePercent(depositAndFinal, 0, 33.33, 1000)[1].amount).toBe(666.7);
});

test('balances the final instalment after an amount edit using exact cents', () => {
  expect(updateScheduleAmount(depositAndFinal, 0, 333.33, 1000)).toMatchObject([
    { percentage: 33.33, amount: 333.33 },
    { percentage: 66.67, amount: 666.67 },
  ]);
});

test('canonicalises a percentage edit to the cent-backed amount', () => {
  expect(updateSchedulePercent(depositAndFinal, 0, 33.333, 1000)).toMatchObject([
    { percentage: 33.33, amount: 333.33 },
    { percentage: 66.67, amount: 666.67 },
  ]);
});

test('rejects zero-amount or zero-percent instalments', () => {
  expect(validatePaymentPlan([
    { label: 'Deposit', percentage: 0, amount: 0, dueOn: '2026-09-01', internalNote: '' },
    { label: 'Final', percentage: 100, amount: 1000, dueOn: '2026-10-01', internalNote: '' },
  ], 1000).valid).toBe(false);
});

test('rejects a payment plan whose percentages do not equal 100 percent', () => {
  expect(validatePaymentPlan([
    { label: 'Deposit', percentage: 49, amount: 500, dueOn: '2026-09-01', internalNote: '' },
    { label: 'Final', percentage: 50, amount: 500, dueOn: '2026-10-01', internalNote: '' },
  ], 1000).valid).toBe(false);
});

test('accepts a cent-balanced schedule with percentages totaling 100 percent', () => {
  expect(validatePaymentPlan([
    { label: 'Deposit', percentage: 33.33, amount: 333.33, dueOn: '2026-09-01', internalNote: '' },
    { label: 'Final', percentage: 66.67, amount: 666.67, dueOn: '2026-10-01', internalNote: '' },
  ], 1000)).toEqual({ valid: true });
});

test('rejects a payment plan whose instalments do not equal the confirmed quote', () => {
  expect(validatePaymentPlan([
    { label: 'Deposit', percentage: 50, amount: 500, dueOn: '2026-09-01', internalNote: '' },
    { label: 'Balance', percentage: 50, amount: 499.99, dueOn: '2026-10-01', internalNote: '' },
  ], 1000)).toEqual({ valid: false, message: 'Instalments must total $1,000.00.' });
});
