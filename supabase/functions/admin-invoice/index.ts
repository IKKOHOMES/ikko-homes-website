import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': '*' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type InstalmentStatus = 'draft' | 'issued' | 'paid' | 'overdue';
type InvoiceStatus = 'draft' | 'issued' | 'paid';
type Instalment = { id: string; label: string; amount: number; due_on: string; status: InstalmentStatus };
type CustomerSnapshot = { customer_name: string; customer_email: string; customer_address: string };
export type GeneratedInvoice = { id: string; invoice_number: string; instalment_id: string; status: 'draft' | 'issued' | 'paid' };
type StoredInvoice = GeneratedInvoice & { total: number; due_on: string } & Partial<CustomerSnapshot>;
type DraftInvoiceInput = { total: number; payment_plan_instalment_id: string; invoice_number: string; due_on: string } & CustomerSnapshot;
export type InvoiceRepository = {
  getConfirmedQuote(orderId: string): Promise<{ id: string; total: number; has_tbd_lines: boolean } | null>;
  getCustomerSnapshot(orderId: string): Promise<CustomerSnapshot>;
  getPaymentPlanInstalments(orderId: string): Promise<Instalment[]>;
  getInvoices(orderId: string): Promise<StoredInvoice[]>;
  reserveInvoiceNumber(): Promise<string>;
  createDraftInvoice(input: DraftInvoiceInput): Promise<StoredInvoice>;
  updateDraftInvoice(input: StoredInvoice & CustomerSnapshot): Promise<StoredInvoice>;
  replaceInvoiceLine(invoiceId: string, label: string, amount: number): Promise<void>;
  deleteDraftInvoice(invoiceId: string): Promise<void>;
};
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
export function isInvoiceAdministrator(profile: unknown, isServiceRole = false): boolean {
  return isServiceRole || (typeof profile === 'object' && profile !== null && (profile as { role?: unknown }).role === 'admin');
}

export async function synchronisePaymentPlanInvoices(repository: InvoiceRepository, orderId: string): Promise<GeneratedInvoice[]> {
  const quote = await repository.getConfirmedQuote(orderId);
  if (!quote || quote.has_tbd_lines) throw new Error('A fully priced confirmed quote is required.');
  const instalments = await repository.getPaymentPlanInstalments(orderId);
  if (!instalments.length) throw new Error('A draft payment plan is required.');
  if (instalments.reduce((total, line) => total + cents(line.amount), 0) !== cents(quote.total)) throw new Error('Instalments must equal the confirmed quote total.');

  const customer = await repository.getCustomerSnapshot(orderId);
  const invoices = await repository.getInvoices(orderId);
  const invoicesByInstalment = new Map(invoices.map((invoice) => [invoice.instalment_id, invoice]));
  const instalmentsById = new Map(instalments.map((instalment) => [instalment.id, instalment]));
  const synchronised: GeneratedInvoice[] = [];

  for (const instalment of instalments.filter((line) => line.status === 'draft')) {
    const current = invoicesByInstalment.get(instalment.id);
    if (current && current.status !== 'draft') throw new Error('Issued instalments cannot be changed.');
    const invoice = current
      ? await repository.updateDraftInvoice({ ...current, ...customer, total: instalment.amount, due_on: instalment.due_on })
      : await repository.createDraftInvoice({ ...customer, total: instalment.amount, payment_plan_instalment_id: instalment.id, invoice_number: await repository.reserveInvoiceNumber(), due_on: instalment.due_on });
    await repository.replaceInvoiceLine(invoice.id, instalment.label, instalment.amount);
    synchronised.push({ id: invoice.id, invoice_number: invoice.invoice_number, instalment_id: instalment.id, status: 'draft' });
  }

  for (const invoice of invoices) {
    const instalment = instalmentsById.get(invoice.instalment_id);
    if (invoice.status === 'draft' && !instalment) await repository.deleteDraftInvoice(invoice.id);
  }
  return synchronised;
}

const normaliseInvoices = (value: unknown): GeneratedInvoice[] => {
  if (!Array.isArray(value)) throw new Error('Unable to synchronise invoices.');
  return value.map((invoice) => {
    const row = invoice as Partial<GeneratedInvoice>;
    if (typeof row.id !== 'string' || typeof row.invoice_number !== 'string' || typeof row.instalment_id !== 'string' || (row.status !== 'draft' && row.status !== 'issued' && row.status !== 'paid')) throw new Error('Unable to synchronise invoices.');
    return { id: row.id, invoice_number: row.invoice_number, instalment_id: row.instalment_id, status: row.status };
  });
};

if (import.meta.main) Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json({ error: 'Unauthorised.' }, 401);
  const token = authorization.replace(/^Bearer\s+/i, ''); const auth = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Unauthorised.' }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
  if (profileError || !isInvoiceAdministrator(profile)) return json({ error: 'Unauthorised.' }, 403);
  try {
    const payload = await request.json() as { action?: unknown; order_id?: unknown; invoice_id?: unknown };
    if ((payload.action !== 'sync' && payload.action !== 'issue') || typeof payload.order_id !== 'string' || !payload.order_id) throw new Error('Order and action are required.');
    if (payload.action === 'issue' && (typeof payload.invoice_id !== 'string' || !payload.invoice_id)) throw new Error('Invoice is required.');
    const { data, error } = payload.action === 'sync'
      ? await admin.rpc('synchronise_payment_plan_invoices', { p_order_id: payload.order_id })
      : await admin.rpc('issue_payment_plan_invoice', { p_order_id: payload.order_id, p_invoice_id: payload.invoice_id });
    if (error) throw new Error(error.message);
    return json({ invoices: normaliseInvoices(data) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to synchronise invoices.' }, 400); }
});