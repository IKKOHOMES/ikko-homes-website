import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculateFurniturePrice } from './pricing.ts';
import { resolveFurnitureProducts } from './product-resolution.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};
const maxDrawingSize = 25 * 1024 * 1024;
const allowedDrawing = /\.(pdf|dwg|jpe?g|png)$/i;

type CustomerPayload = { firstName: unknown; lastName: unknown; email: unknown; phone: unknown; address: unknown; note?: unknown };
type FurnitureLine = { id: unknown; kind: 'furniture'; productId?: unknown; slug?: unknown; name?: unknown; quantity: unknown; finish?: unknown };
type CabinetryLine = { id: unknown; kind: 'cabinetry'; cabinetryProductId: unknown; rangeId: unknown; name: unknown; quantity: unknown };
type SubmittedLine = FurnitureLine | CabinetryLine;

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}


function parsePayload(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') throw new Error('Order details are required.');
  let payload: { customer?: CustomerPayload; lines?: SubmittedLine[] };
  try { payload = JSON.parse(value) as { customer?: CustomerPayload; lines?: SubmittedLine[] }; } catch { throw new Error('Order details are invalid.'); }
  if (!payload.customer || !Array.isArray(payload.lines) || payload.lines.length === 0) throw new Error('Your cart is empty.');
  return payload;
}

function validQuantity(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 99;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Order processing is unavailable.' }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const accessToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const authClient = anonKey && accessToken ? createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
  const { data: authData } = authClient && accessToken ? await authClient.auth.getUser(accessToken) : { data: { user: null } };
  const signedInUser = authData.user;
  let createdOrderId: string | null = null;
  const uploadedPaths: string[] = [];

  try {
    const form = await request.formData();
    const { customer: customerPayload, lines } = parsePayload(form.get('payload'));
    const firstName = requiredString(customerPayload.firstName, 'First name');
    const lastName = requiredString(customerPayload.lastName, 'Last name');
    const email = requiredString(customerPayload.email, 'Email').toLowerCase();
    const phone = requiredString(customerPayload.phone, 'Phone');
    const address = requiredString(customerPayload.address, 'Address');
    const note = typeof customerPayload.note === 'string' ? customerPayload.note.trim() : '';
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (signedInUser?.email && signedInUser.email.toLowerCase() !== email) throw new Error('Use the email address linked to your account.');
    if (lines.some((line) => !validQuantity(line.quantity))) throw new Error('One or more quantities are invalid.');

    const furnitureLines = lines.filter((line): line is FurnitureLine => line.kind === 'furniture');
    const cabinetryLines = lines.filter((line): line is CabinetryLine => line.kind === 'cabinetry');
    if (furnitureLines.length + cabinetryLines.length !== lines.length) throw new Error('One or more cart lines are invalid.');
    const resolvedFurnitureProducts = await resolveFurnitureProducts(furnitureLines, async (field, values) => {
      const { data, error } = await admin.from('products')
        .select('id, slug, name, price')
        .eq('is_active', true)
        .in(field, values);
      if (error) throw new Error(`Unable to verify the products in your cart. (${field}: ${error.message})`);
      return data ?? [];
    });

    const verifiedCabinetry = new Map<string, { displayName: string }>();
    for (const line of cabinetryLines) {
      const file = form.get(`drawing:${requiredString(line.id, 'Drawing')}`);
      if (!(file instanceof File) || file.size <= 0 || file.size > maxDrawingSize || !allowedDrawing.test(file.name)) {
        throw new Error('Each cabinetry item needs a PDF, DWG, JPG or PNG drawing under 25 MB.');
      }
      const cabinetryProductId = requiredString(line.cabinetryProductId, 'Cabinetry product');
      const rangeId = requiredString(line.rangeId, 'Cabinetry range');
      const requestedName = requiredString(line.name, 'Cabinetry product');
      const { data: cabinetryProduct, error: cabinetryProductError } = await admin.from('cabinetry_products')
        .select('id, headline, style_range_id').eq('id', cabinetryProductId).eq('style_range_id', rangeId).eq('is_active', true).maybeSingle();
      if (cabinetryProductError || !cabinetryProduct || cabinetryProduct.headline !== requestedName) {
        throw new Error('One or more cabinetry products are no longer available.');
      }
      verifiedCabinetry.set(requiredString(line.id, 'Drawing'), { displayName: cabinetryProduct.headline });
    }

    const { data: existingCustomer, error: existingCustomerError } = await admin.from('customers')
      .select('id, auth_user_id').eq('email', email).maybeSingle();
    if (existingCustomerError) throw new Error('Unable to save customer details.');
    if (signedInUser && existingCustomer?.auth_user_id && existingCustomer.auth_user_id !== signedInUser.id) {
      throw new Error('This email address is already linked to another account.');
    }
    const customerPayloadForSave = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      ...(signedInUser ? { auth_user_id: signedInUser.id } : {}),
    };
    const { data: customer, error: customerError } = await admin.from('customers').upsert(
      customerPayloadForSave,
      { onConflict: 'email' },
    ).select('id, first_name, last_name, email, address, auth_user_id, discount_percent').single();
    if (customerError || !customer) throw new Error('Unable to save customer details.');

    const discountPercent = signedInUser && customer.auth_user_id === signedInUser.id ? Number(customer.discount_percent) : 0;
    const pricedFurnitureLines = furnitureLines.map((line, index) => {
      const product = resolvedFurnitureProducts[index];
      if (!product) throw new Error('One or more products are no longer available.');
      const finish = typeof line.finish === 'string' && line.finish.trim() ? line.finish.trim() : null;
      const price = calculateFurniturePrice(Number(product.price), discountPercent, line.quantity as number);
      return { product, quantity: line.quantity as number, finish, ...price };
    });
    const furnitureDiscountTotal = pricedFurnitureLines.reduce((total, line) => total + line.discountTotal, 0);

    const orderNumber = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: order, error: orderError } = await admin.from('orders').insert({
      order_number: orderNumber,
      customer_id: customer.id,
      status: 'new',
      internal_note: note,
      discount_percent: discountPercent,
      furniture_discount_total: furnitureDiscountTotal,
    }).select('id').single();
    if (orderError || !order) throw new Error('Unable to create the order.');
    createdOrderId = order.id;

    const createdFurnitureLines: Array<{ displayName: string; unitPrice: number; quantity: number; finish: string | null }> = [];
    for (const line of pricedFurnitureLines) {
      const { error: lineError } = await admin.from('order_lines').insert({
        order_id: order.id, line_kind: 'furniture', product_id: line.product.id, display_name: line.product.name,
        unit_price: line.chargedUnitPrice, list_unit_price: line.listUnitPrice, quantity: line.quantity, finish: line.finish,
      });
      if (lineError) throw new Error('Unable to create the order lines.');
      createdFurnitureLines.push({ displayName: line.product.name, unitPrice: line.chargedUnitPrice, quantity: line.quantity, finish: line.finish });
    }

    for (const line of cabinetryLines) {
      const drawingId = requiredString(line.id, 'Drawing');
      const file = form.get(`drawing:${drawingId}`) as File;
      const cabinetry = verifiedCabinetry.get(drawingId);
      if (!cabinetry) throw new Error('One or more cabinetry products are no longer available.');
      const { data: orderLine, error: lineError } = await admin.from('order_lines').insert({
        order_id: order.id, line_kind: 'cabinetry', display_name: cabinetry.displayName, unit_price: null, quantity: line.quantity, finish: null,
      }).select('id').single();
      if (lineError || !orderLine) throw new Error('Unable to create the cabinetry order line.');
      const storagePath = `${order.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await admin.storage.from('cabinetry-drawings').upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw new Error('Unable to upload the cabinetry drawing.');
      uploadedPaths.push(storagePath);
      const { error: drawingError } = await admin.from('cabinetry_drawings').insert({
        order_line_id: orderLine.id, storage_path: storagePath, file_name: file.name, file_size: file.size, content_type: file.type || 'application/octet-stream',
      });
      if (drawingError) throw new Error('Unable to attach the cabinetry drawing.');
    }

    if (cabinetryLines.length > 0) {
      const { error } = await admin.from('order_status_events').insert({ order_id: order.id, status: 'new', note: 'Cabinetry drawing received; quotation required.' });
      if (error) throw new Error('Unable to finalise the order.');
      return json({ order_number: orderNumber, document_kind: 'quote-pending', discount_percent: discountPercent, furniture_discount_total: furnitureDiscountTotal });
    }

    const { data: invoiceNumber, error: sequenceError } = await admin.rpc('reserve_invoice_number');
    if (sequenceError || typeof invoiceNumber !== 'string') throw new Error('Unable to reserve an invoice number.');
    const total = createdFurnitureLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const { data: invoice, error: invoiceError } = await admin.from('invoices').insert({
      invoice_number: invoiceNumber, order_id: order.id, customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_email: customer.email, customer_address: customer.address, total, status: 'issued',
    }).select('id').single();
    if (invoiceError || !invoice) throw new Error('Unable to create the invoice.');
    const { error: invoiceLinesError } = await admin.from('invoice_lines').insert(createdFurnitureLines.map((line) => ({
      invoice_id: invoice.id, display_name: line.displayName, unit_price: line.unitPrice, quantity: line.quantity, finish: line.finish,
    })));
    if (invoiceLinesError) throw new Error('Unable to create the invoice lines.');
    const { error: statusError } = await admin.from('orders').update({ status: 'invoiced' }).eq('id', order.id);
    if (statusError) throw new Error('Unable to finalise the order.');
    const { error: eventError } = await admin.from('order_status_events').insert({ order_id: order.id, status: 'invoiced', note: `Invoice ${invoiceNumber} issued.` });
    if (eventError) throw new Error('Unable to finalise the order.');
    return json({ order_number: orderNumber, document_kind: 'invoice', discount_percent: discountPercent, furniture_discount_total: furnitureDiscountTotal });
  } catch (error) {
    if (createdOrderId) await admin.from('orders').delete().eq('id', createdOrderId);
    if (uploadedPaths.length) await admin.storage.from('cabinetry-drawings').remove(uploadedPaths);
    const message = error instanceof Error ? error.message : 'Unable to create the order.';
    return json({ error: message }, 400);
  }
});
