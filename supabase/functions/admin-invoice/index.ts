import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': '*' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type InstalmentStatus = 'draft' | 'issued' | 'paid' | 'overdue';
type InvoiceStatus = 'draft' | 'issued' | 'paid';
type Instalment = { id: string; label: string; amount: number; due_on: string; status: InstalmentStatus };
export type GeneratedInvoice = { id: string; invoice_number: string; instalment_id: string; status: 'draft' | 'issued' | 'paid' };
type StoredInvoice = GeneratedInvoice & { total: number; due_on: string };
type DraftInvoiceInput = { total: number; payment_plan_instalment_id: string; invoice_number: string; due_on: string };
export type InvoiceRepository = {
  getConfirmedQuote(orderId: string): Promise<{ id: string; total: number; has_tbd_lines: boolean } | null>;
  getPaymentPlanInstalments(orderId: string): Promise<Instalment[]>;
  getInvoices(orderId: string): Promise<StoredInvoice[]>;
  reserveInvoiceNumber(): Promise<string>;
  createDraftInvoice(input: DraftInvoiceInput): Promise<StoredInvoice>;
  updateDraftInvoice(input: StoredInvoice): Promise<StoredInvoice>;
  replaceInvoiceLine(invoiceId: string, label: string, amount: number): Promise<void>;
  deleteDraftInvoice(invoiceId: string): Promise<void>;
};
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);

export async function synchronisePaymentPlanInvoices(repository: InvoiceRepository, orderId: string): Promise<GeneratedInvoice[]> {
  const quote = await repository.getConfirmedQuote(orderId);
  if (!quote || quote.has_tbd_lines) throw new Error('A fully priced confirmed quote is required.');
  const instalments = await repository.getPaymentPlanInstalments(orderId);
  if (!instalments.length) throw new Error('A draft payment plan is required.');
  if (instalments.reduce((total, line) => total + cents(line.amount), 0) !== cents(quote.total)) throw new Error('Instalments must equal the confirmed quote total.');

  const invoices = await repository.getInvoices(orderId);
  const invoicesByInstalment = new Map(invoices.map((invoice) => [invoice.instalment_id, invoice]));
  const instalmentsById = new Map(instalments.map((instalment) => [instalment.id, instalment]));
  const synchronised: GeneratedInvoice[] = [];

  for (const instalment of instalments.filter((line) => line.status === 'draft')) {
    const current = invoicesByInstalment.get(instalment.id);
    if (current && current.status !== 'draft') throw new Error('Issued instalments cannot be changed.');
    const invoice = current
      ? await repository.updateDraftInvoice({ ...current, total: instalment.amount, due_on: instalment.due_on })
      : await repository.createDraftInvoice({ total: instalment.amount, payment_plan_instalment_id: instalment.id, invoice_number: await repository.reserveInvoiceNumber(), due_on: instalment.due_on });
    await repository.replaceInvoiceLine(invoice.id, instalment.label, instalment.amount);
    synchronised.push({ id: invoice.id, invoice_number: invoice.invoice_number, instalment_id: instalment.id, status: 'draft' });
  }

  for (const invoice of invoices) {
    const instalment = instalmentsById.get(invoice.instalment_id);
    if (invoice.status === 'draft' && !instalment) await repository.deleteDraftInvoice(invoice.id);
  }
  return synchronised;
}

if (import.meta.main) Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json({ error: 'Unauthorised.' }, 401);
  const token = authorization.replace(/^Bearer\s+/i, ''); const auth = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Unauthorised.' }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: profile } = await admin.from('profiles').select('id').eq('id', userData.user.id).maybeSingle();
  if (!profile) return json({ error: 'Unauthorised.' }, 403);
  try {
    const payload = await request.json() as { action?: unknown; order_id?: unknown; invoice_id?: unknown };
    if ((payload.action !== 'sync' && payload.action !== 'issue') || typeof payload.order_id !== 'string' || !payload.order_id) throw new Error('Order and action are required.');
    const { data: order, error: orderError } = await admin.from('orders').select('id, order_number, status, customers(first_name, last_name, email, address)').eq('id', payload.order_id).single();
    if (orderError || !order || (order.status !== 'quoted' && order.status !== 'invoiced')) throw new Error('Only quoted orders can be invoiced.');
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers; if (!customer) throw new Error('A customer is required.');

    if (payload.action === 'issue') {
      if (typeof payload.invoice_id !== 'string' || !payload.invoice_id) throw new Error('Invoice is required.');
      const { data: invoice, error: invoiceError } = await admin.from('invoices').update({ status: 'issued' }).eq('id', payload.invoice_id).eq('order_id', order.id).eq('status', 'draft').select('id, invoice_number, payment_plan_instalment_id').single();
      if (invoiceError || !invoice || !invoice.payment_plan_instalment_id) throw new Error('A draft invoice for this order is required.');
      const { data: instalment, error: instalmentError } = await admin.from('payment_plan_instalments').update({ status: 'issued' }).eq('id', invoice.payment_plan_instalment_id).eq('order_id', order.id).eq('status', 'draft').select('id').single();
      if (instalmentError || !instalment) throw new Error('Unable to issue the payment instalment.');
      if (order.status !== 'invoiced') {
        const { error: statusError } = await admin.from('orders').update({ status: 'invoiced' }).eq('id', order.id); if (statusError) throw new Error('Unable to update order status.');
      }
      const { error: eventError } = await admin.from('order_status_events').insert({ order_id: order.id, status: 'invoiced', note: `Invoice ${invoice.invoice_number} issued.` }); if (eventError) throw new Error('Unable to update order history.');
      return json({ invoices: [{ id: invoice.id, invoice_number: invoice.invoice_number, instalment_id: invoice.payment_plan_instalment_id, status: 'issued' }] });
    }

    const repository: InvoiceRepository = {
      getConfirmedQuote: async (orderId) => { const { data, error } = await admin.from('quotes').select('id, total, quote_lines(is_tbd)').eq('order_id', orderId).eq('status', 'confirmed').order('version', { ascending: false }).limit(1).maybeSingle(); if (error || !data) return null; return { id: data.id, total: Number(data.total), has_tbd_lines: (data.quote_lines ?? []).some((line) => line.is_tbd) }; },
      getPaymentPlanInstalments: async (orderId) => { const { data, error } = await admin.from('payment_plan_instalments').select('id, label, amount, due_on, status').eq('order_id', orderId).order('sequence'); if (error) throw new Error('Unable to load the payment plan.'); return (data ?? []).map((line) => ({ ...line, amount: Number(line.amount) })); },
      getInvoices: async (orderId) => { const { data, error } = await admin.from('invoices').select('id, invoice_number, payment_plan_instalment_id, total, due_on, status').eq('order_id', orderId); if (error) throw new Error('Unable to load invoices.'); return (data ?? []).filter((invoice) => typeof invoice.payment_plan_instalment_id === 'string' && (invoice.status === 'draft' || invoice.status === 'issued' || invoice.status === 'paid')).map((invoice) => ({ id: invoice.id, invoice_number: invoice.invoice_number, instalment_id: invoice.payment_plan_instalment_id as string, total: Number(invoice.total), due_on: invoice.due_on ?? '', status: invoice.status as InvoiceStatus })); },
      reserveInvoiceNumber: async () => { const { data, error } = await admin.rpc('reserve_invoice_number'); if (error || typeof data !== 'string') throw new Error('Unable to reserve invoice number.'); return data; },
      createDraftInvoice: async (input) => { const { data, error } = await admin.from('invoices').insert({ invoice_number: input.invoice_number, order_id: order.id, customer_name: `${customer.first_name} ${customer.last_name}`, customer_email: customer.email, customer_address: customer.address, total: input.total, status: 'draft', payment_plan_instalment_id: input.payment_plan_instalment_id, due_on: input.due_on }).select('id, invoice_number, payment_plan_instalment_id, total, due_on, status').single(); if (error || !data) throw new Error('Unable to create invoice.'); return { id: data.id, invoice_number: data.invoice_number, instalment_id: data.payment_plan_instalment_id, total: Number(data.total), due_on: data.due_on, status: 'draft' }; },
      updateDraftInvoice: async (input) => { const { data, error } = await admin.from('invoices').update({ total: input.total, due_on: input.due_on }).eq('id', input.id).eq('order_id', order.id).eq('status', 'draft').select('id, invoice_number, payment_plan_instalment_id, total, due_on, status').single(); if (error || !data || typeof data.payment_plan_instalment_id !== 'string') throw new Error('Unable to update invoice draft.'); return { id: data.id, invoice_number: data.invoice_number, instalment_id: data.payment_plan_instalment_id, total: Number(data.total), due_on: data.due_on, status: 'draft' }; },
      replaceInvoiceLine: async (invoiceId, label, amount) => { const { error: deleteError } = await admin.from('invoice_lines').delete().eq('invoice_id', invoiceId); if (deleteError) throw new Error('Unable to update invoice line.'); const { error } = await admin.from('invoice_lines').insert({ invoice_id: invoiceId, display_name: `${label} — ${order.order_number}`, unit_price: amount, quantity: 1, finish: null }); if (error) throw new Error('Unable to create invoice line.'); },
      deleteDraftInvoice: async (invoiceId) => { const { error } = await admin.from('invoices').delete().eq('id', invoiceId).eq('order_id', order.id).eq('status', 'draft'); if (error) throw new Error('Unable to remove stale invoice draft.'); },
    };
    return json({ invoices: await synchronisePaymentPlanInvoices(repository, order.id) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to synchronise invoices.' }, 400); }
});