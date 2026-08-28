import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': '*' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Instalment = { id: string; label: string; amount: number; due_on: string };
export type GeneratedInvoice = { id: string; invoice_number: string; instalment_id: string };
export type InvoiceRepository = {
  getConfirmedQuote(orderId: string): Promise<{ id: string; total: number; has_tbd_lines: boolean } | null>;
  getDraftInstalments(orderId: string): Promise<Instalment[]>;
  reserveInvoiceNumber(): Promise<string>;
  insertInvoice(input: { total: number; payment_plan_instalment_id: string; invoice_number: string; due_on: string }): Promise<{ id: string }>;
  insertInvoiceLine(invoiceId: string, label: string, amount: number): Promise<void>;
  markInstalmentIssued(instalmentId: string): Promise<void>;
};
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);

export async function issuePaymentPlanInvoices(repository: InvoiceRepository, orderId: string): Promise<GeneratedInvoice[]> {
  const quote = await repository.getConfirmedQuote(orderId);
  if (!quote || quote.has_tbd_lines) throw new Error('A fully priced confirmed quote is required.');
  const instalments = await repository.getDraftInstalments(orderId);
  if (!instalments.length) throw new Error('A draft payment plan is required.');
  if (instalments.reduce((total, line) => total + cents(line.amount), 0) !== cents(quote.total)) throw new Error('Instalments must equal the confirmed quote total.');
  const issued: GeneratedInvoice[] = [];
  for (const instalment of instalments) {
    const invoiceNumber = await repository.reserveInvoiceNumber();
    const invoice = await repository.insertInvoice({ total: instalment.amount, payment_plan_instalment_id: instalment.id, invoice_number: invoiceNumber, due_on: instalment.due_on });
    await repository.insertInvoiceLine(invoice.id, instalment.label, instalment.amount);
    await repository.markInstalmentIssued(instalment.id);
    issued.push({ id: invoice.id, invoice_number: invoiceNumber, instalment_id: instalment.id });
  }
  return issued;
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
    const payload = await request.json() as { order_id?: unknown }; if (typeof payload.order_id !== 'string' || !payload.order_id) throw new Error('Order is required.');
    const { data: order, error: orderError } = await admin.from('orders').select('id, order_number, status, customers(first_name, last_name, email, address)').eq('id', payload.order_id).single();
    if (orderError || !order || order.status !== 'quoted') throw new Error('Only quoted orders can be invoiced.');
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers; if (!customer) throw new Error('A customer is required.');
    const repository: InvoiceRepository = {
      getConfirmedQuote: async (orderId) => { const { data, error } = await admin.from('quotes').select('id, total, quote_lines(is_tbd)').eq('order_id', orderId).eq('status', 'confirmed').order('version', { ascending: false }).limit(1).maybeSingle(); if (error || !data) return null; return { id: data.id, total: Number(data.total), has_tbd_lines: (data.quote_lines ?? []).some((line) => line.is_tbd) }; },
      getDraftInstalments: async (orderId) => { const { data, error } = await admin.from('payment_plan_instalments').select('id, label, amount, due_on').eq('order_id', orderId).eq('status', 'draft').order('sequence'); if (error) throw new Error('Unable to load the payment plan.'); return (data ?? []).map((line) => ({ ...line, amount: Number(line.amount) })); },
      reserveInvoiceNumber: async () => { const { data, error } = await admin.rpc('reserve_invoice_number'); if (error || typeof data !== 'string') throw new Error('Unable to reserve invoice number.'); return data; },
      insertInvoice: async (input) => { const { data, error } = await admin.from('invoices').insert({ invoice_number: input.invoice_number, order_id: order.id, customer_name: `${customer.first_name} ${customer.last_name}`, customer_email: customer.email, customer_address: customer.address, total: input.total, status: 'issued', payment_plan_instalment_id: input.payment_plan_instalment_id, due_on: input.due_on }).select('id').single(); if (error || !data) throw new Error('Unable to create invoice.'); return data; },
      insertInvoiceLine: async (invoiceId, label, amount) => { const { error } = await admin.from('invoice_lines').insert({ invoice_id: invoiceId, display_name: `${label} — ${order.order_number}`, unit_price: amount, quantity: 1, finish: null }); if (error) throw new Error('Unable to create invoice line.'); },
      markInstalmentIssued: async (instalmentId) => { const { error } = await admin.from('payment_plan_instalments').update({ status: 'issued' }).eq('id', instalmentId).eq('status', 'draft'); if (error) throw new Error('Unable to update instalment.'); },
    };
    const invoices = await issuePaymentPlanInvoices(repository, order.id);
    const { error: statusError } = await admin.from('orders').update({ status: 'invoiced' }).eq('id', order.id); if (statusError) throw new Error('Unable to update order status.');
    const { error: eventError } = await admin.from('order_status_events').insert({ order_id: order.id, status: 'invoiced', note: `${invoices.length} instalment invoice(s) issued.` }); if (eventError) throw new Error('Unable to update order history.');
    return json({ invoices });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to issue invoices.' }, 400); }
});
