import { getAdminSupabaseClient } from './supabase';

export function normaliseInvoiceResponse(value: unknown) {
  if (!value || typeof value !== 'object' || typeof (value as { invoice_number?: unknown }).invoice_number !== 'string') {
    throw new Error('Unable to issue the invoice.');
  }
  return { invoiceNumber: (value as { invoice_number: string }).invoice_number };
}

export async function issueInvoice(orderId: string) {
  const { data, error } = await getAdminSupabaseClient().functions.invoke('admin-invoice', { body: { order_id: orderId } });
  if (error) throw new Error('Unable to issue the invoice.');
  return normaliseInvoiceResponse(data);
}
