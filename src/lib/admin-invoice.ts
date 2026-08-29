import { getAdminSupabaseClient } from './supabase';

export type GeneratedInvoice = { id: string; invoiceNumber: string; instalmentId: string; status: 'draft' | 'issued' | 'paid' };
export function normaliseInvoiceResponse(value: unknown): { invoices: GeneratedInvoice[] } {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { invoices?: unknown }).invoices)) throw new Error('Unable to issue the invoice.');
  const invoices = (value as { invoices: unknown[] }).invoices.map((invoice) => {
    const value = invoice as { id?: unknown; invoice_number?: unknown; instalment_id?: unknown; status?: unknown };
    if (typeof value.id !== 'string' || typeof value.invoice_number !== 'string' || typeof value.instalment_id !== 'string' || (value.status !== 'draft' && value.status !== 'issued' && value.status !== 'paid')) throw new Error('Unable to issue the invoice.');
    return { id: value.id, invoiceNumber: value.invoice_number, instalmentId: value.instalment_id, status: value.status as GeneratedInvoice['status'] };
  });
  return { invoices };
}
export async function synchroniseInvoiceDrafts(orderId: string) {
  const { data, error } = await getAdminSupabaseClient().functions.invoke('admin-invoice', { body: { action: 'sync', order_id: orderId } });
  if (error) throw new Error('Unable to synchronise invoice drafts.');
  return normaliseInvoiceResponse(data);
}
export async function issueInvoice(orderId: string, invoiceId: string) {
  const { data, error } = await getAdminSupabaseClient().functions.invoke('admin-invoice', { body: { action: 'issue', order_id: orderId, invoice_id: invoiceId } });
  if (error) throw new Error('Unable to issue the invoice.');
  return normaliseInvoiceResponse(data);
}