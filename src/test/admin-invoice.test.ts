import { expect, test } from 'vitest';
import { normaliseInvoiceResponse } from '../lib/admin-invoice';

test('returns draft instalment invoices synchronised from an approved quote', () => {
  expect(normaliseInvoiceResponse({ invoices: [{ id: 'invoice-1', invoice_number: 'IKKO-1001', instalment_id: 'plan-1', status: 'draft' }] })).toEqual({
    invoices: [{ id: 'invoice-1', invoiceNumber: 'IKKO-1001', instalmentId: 'plan-1', status: 'draft' }],
  });
});

test('rejects an invoice response without a valid lifecycle status', () => {
  expect(() => normaliseInvoiceResponse({ invoices: [{ id: 'invoice-1', invoice_number: 'IKKO-1001', instalment_id: 'plan-1', status: 'invalid' }] })).toThrow('Unable to issue the invoice.');
});