import { expect, test, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('../lib/supabase', () => ({ getAdminSupabaseClient: () => ({ functions: { invoke } }) }));

import { normaliseInvoiceResponse } from '../lib/admin-invoice';

test('accepts every generated instalment invoice from the Edge Function', () => {
  expect(normaliseInvoiceResponse({ invoices: [{ id: 'invoice-1', invoice_number: 'IKKO-1001', instalment_id: 'plan-1' }] })).toEqual({ invoices: [{ id: 'invoice-1', invoiceNumber: 'IKKO-1001', instalmentId: 'plan-1' }] });
});
