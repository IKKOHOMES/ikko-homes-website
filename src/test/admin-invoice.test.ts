import { expect, test } from 'vitest';
import { normaliseInvoiceResponse } from '../lib/admin-invoice';

test('returns the invoice number created from an approved quote', () => {
  expect(normaliseInvoiceResponse({ invoice_number: 'IKKO-1001' })).toEqual({ invoiceNumber: 'IKKO-1001' });
});

test('rejects a malformed invoice response', () => {
  expect(() => normaliseInvoiceResponse({})).toThrow('Unable to issue the invoice.');
});
