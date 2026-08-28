import { expect, test } from 'vitest';
import { normaliseInvoiceResponse } from '../lib/admin-invoice';

test('returns every instalment invoice created from an approved quote', () => {
  expect(normaliseInvoiceResponse({ invoices: [{ id: 'invoice-1', invoice_number: 'IKKO-1001', instalment_id: 'plan-1' }] })).toEqual({
    invoices: [{ id: 'invoice-1', invoiceNumber: 'IKKO-1001', instalmentId: 'plan-1' }],
  });
});

test('rejects a malformed invoice response', () => {
  expect(() => normaliseInvoiceResponse({})).toThrow('Unable to issue the invoice.');
});