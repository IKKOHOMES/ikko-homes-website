import { expect, test, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('../lib/supabase', () => ({ getAdminSupabaseClient: () => ({ functions: { invoke } }) }));

import { normaliseInvoiceResponse, synchroniseInvoiceDrafts } from '../lib/admin-invoice';

test('accepts every generated instalment invoice from the Edge Function', () => {
  expect(normaliseInvoiceResponse({ invoices: [{ id: 'invoice-1', invoice_number: 'IKKO-1001', instalment_id: 'plan-1', status: 'draft' }] })).toEqual({ invoices: [{ id: 'invoice-1', invoiceNumber: 'IKKO-1001', instalmentId: 'plan-1', status: 'draft' }] });
});

test('sends the explicit sync action when synchronising invoice drafts', async () => {
  invoke.mockResolvedValueOnce({ data: { invoices: [{ id: 'invoice-1', invoice_number: 'IKKO-1001', instalment_id: 'plan-1', status: 'draft' }] }, error: null });

  await expect(synchroniseInvoiceDrafts('order-1')).resolves.toEqual({ invoices: [{ id: 'invoice-1', invoiceNumber: 'IKKO-1001', instalmentId: 'plan-1', status: 'draft' }] });

  expect(invoke).toHaveBeenLastCalledWith('admin-invoice', { body: { action: 'sync', order_id: 'order-1' } });
});