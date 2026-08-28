import { expect, test } from 'vitest';
import { validatePaymentPlan } from '../lib/payment-plan';

test('rejects a payment plan whose instalments do not equal the confirmed quote', () => {
  expect(validatePaymentPlan([
    { label: 'Deposit', amount: 500, dueOn: '2026-09-01', internalNote: '' },
    { label: 'Balance', amount: 499.99, dueOn: '2026-10-01', internalNote: '' },
  ], 1000)).toEqual({ valid: false, message: 'Instalments must total $1,000.00.' });
});
