import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json({ error: 'Unauthorised.' }, 401);

  const token = authorization.replace(/^Bearer\s+/i, '');
  const auth = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userError } = await auth.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Unauthorised.' }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userData.user.id).maybeSingle();
  if (!profile) return json({ error: 'Unauthorised.' }, 403);

  try {
    const payload = await request.json() as { order_id?: unknown };
    if (typeof payload.order_id !== 'string' || !payload.order_id) throw new Error('Order is required.');
    const { data: order, error: orderError } = await admin.from('orders').select('id, order_number, status, customers(first_name, last_name, email, address), invoices(id), quotes(id, version, total, quote_lines(display_name, unit_price, quantity))').eq('id', payload.order_id).single();
    if (orderError || !order) throw new Error('Order not found.');
    if (order.status !== 'quoted') throw new Error('Only quoted orders can be invoiced.');
    if ((order.invoices ?? []).length) throw new Error('An invoice already exists for this order.');
    const quote = [...(order.quotes ?? [])].sort((left, right) => right.version - left.version)[0];
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    if (!quote || !customer) throw new Error('A quotation and customer are required.');
    const { data: invoiceNumber, error: numberError } = await admin.rpc('reserve_invoice_number');
    if (numberError || typeof invoiceNumber !== 'string') throw new Error('Unable to reserve invoice number.');
    const { data: invoice, error: invoiceError } = await admin.from('invoices').insert({
      invoice_number: invoiceNumber, order_id: order.id, customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_email: customer.email, customer_address: customer.address, total: quote.total, status: 'issued',
    }).select('id').single();
    if (invoiceError || !invoice) throw new Error('Unable to create invoice.');
    const lines = quote.quote_lines?.length ? quote.quote_lines : [{ display_name: 'Custom cabinetry quotation', unit_price: quote.total, quantity: 1 }];
    const { error: linesError } = await admin.from('invoice_lines').insert(lines.map((line) => ({ invoice_id: invoice.id, display_name: line.display_name, unit_price: line.unit_price, quantity: line.quantity, finish: null })));
    if (linesError) throw new Error('Unable to create invoice lines.');
    const { error: statusError } = await admin.from('orders').update({ status: 'invoiced' }).eq('id', order.id);
    if (statusError) throw new Error('Unable to update order status.');
    const { error: eventError } = await admin.from('order_status_events').insert({ order_id: order.id, status: 'invoiced', note: `Invoice ${invoiceNumber} issued from quotation v${quote.version}.` });
    if (eventError) throw new Error('Unable to update order history.');
    return json({ invoice_number: invoiceNumber });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to issue invoice.' }, 400);
  }
});
