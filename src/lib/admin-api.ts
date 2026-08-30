import { getAdminSupabaseClient } from './supabase';
import { compressPublicImage } from './image-compression';
import type { AdminCustomer, AdminOrder, BlogPost, BlogStatus, InvoiceStatus, ManagedCabinetryImage, ManagedCabinetryProduct, ManagedHomeContent, ManagedHomeThemeBlock, ManagedPaletteItem, ManagedProduct, ManagedProductCategory, ManagedProject, ManagedServicePillar, ManagedStyleRange, OrderStatus, ProductColour } from '../types/domain';
import { loadExistingSampleAssets, loadExistingSampleRecords } from './sample-content';
import { normaliseProductDetailContent, type ProductDetailContent } from '../types/product-detail-content';
import { calculateQuoteTotals, validatePaymentPlan, type PaymentPlanDraft } from './payment-plan';

export type PaymentPlanInstalment = PaymentPlanDraft & { id: string; status: 'draft' | 'issued' | 'paid' | 'overdue'; paidAt: string | null };
export type EditableQuoteLine = { id?: string; displayName: string; unitPrice: number; quantity: number; isTbd: boolean };
export type QuoteSaveInput = { quoteId: string; orderId: string; expiresOn: string; internalNote: string; discountTotal?: number; lines: EditableQuoteLine[] };
export type EditableQuote = { id: string; orderId: string; version: number; status: 'draft' | 'confirmed'; subtotal?: number; discountTotal?: number; gstTotal?: number; total: number; expiresOn: string; internalNote: string; createdAt?: string; lines: EditableQuoteLine[] };
export type AdminOrderDetail = {
  order: AdminOrder;
  customer: { email: string; phone: string; address: string };
  internalNote: string;
  lines: Array<{ id: string; name: string; kind: 'furniture' | 'cabinetry'; unitPrice: number | null; quantity: number; finish: string | null }>;
  drawings: Array<{ fileName: string; signedUrl: string | null }>;
  quotes: EditableQuote[];
  paymentPlan: PaymentPlanInstalment[];
  invoices: Array<{ id: string; number: string; total: number; status: InvoiceStatus; dueOn: string | null; paidAt: string | null; paymentPlanInstalmentId: string | null }>;
};
type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  customers: { id: string; first_name: string; last_name: string } | null;
  order_lines: Array<{ line_kind: 'furniture' | 'cabinetry'; unit_price: number | string | null; quantity: number }>;
  invoices: Array<{ status: InvoiceStatus }>;
  quotes?: Array<{ total: number | string; version: number }>;
};

export function mapAdminOrderRow(row: OrderRow): AdminOrder {
  const hasCabinetry = row.order_lines.some((line) => line.line_kind === 'cabinetry');
  const furnitureTotal = row.order_lines.reduce<number>((sum, line) => sum + (line.unit_price === null ? 0 : Number(line.unit_price) * line.quantity), 0);
  const latestQuote = row.quotes?.reduce<{ total: number | string; version: number } | null>((latest, quote) => !latest || quote.version > latest.version ? quote : latest, null) ?? null;
  const total = hasCabinetry ? (latestQuote ? Number(latestQuote.total) : null) : furnitureTotal;
  return {
    id: row.id, number: row.order_number, status: row.status, customerId: row.customers?.id ?? '',
    customerName: row.customers ? `${row.customers.first_name} ${row.customers.last_name}` : 'Unknown customer', createdAt: row.created_at,
    total, hasCabinetry, invoiceStatus: row.invoices[0]?.status ?? null,
  };
}

export async function listAdminOrders(filters: { query?: string; status?: OrderStatus | 'all' } = {}): Promise<AdminOrder[]> {
  const { data, error } = await getAdminSupabaseClient().from('orders').select('id, order_number, status, created_at, customers(id, first_name, last_name), order_lines(line_kind, unit_price, quantity), invoices(status), quotes(total, version)').order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load orders.');
  return ((data ?? []) as unknown as OrderRow[]).map(mapAdminOrderRow).filter((order) => {
    const query = filters.query?.trim().toLowerCase();
    const matchesQuery = !query || order.number.toLowerCase().includes(query) || order.customerName.toLowerCase().includes(query);
    const matchesStatus = !filters.status || filters.status === 'all' || order.status === filters.status;
    return matchesQuery && matchesStatus;
  });
}

type DetailRow = Omit<OrderRow, 'customers' | 'order_lines' | 'quotes' | 'invoices'> & {
  internal_note: string;
  customers: { id: string; first_name: string; last_name: string; email: string; phone: string; address: string } | null;
  order_lines: Array<{ id: string; line_kind: 'furniture' | 'cabinetry'; display_name: string; unit_price: number | string | null; quantity: number; finish: string | null; cabinetry_drawings: Array<{ storage_path: string; file_name: string }> }>;
  quotes: Array<{ id: string; version: number; status: 'draft' | 'confirmed'; quote_number: string | null; subtotal: number | string | null; discount_total: number | string | null; gst_total: number | string | null; total: number | string; expires_on: string; internal_note: string; created_at: string; quote_lines: Array<{ id: string; display_name: string; unit_price: number | string; quantity: number; is_tbd: boolean }> }> ;
  invoices: Array<{ id: string; invoice_number: string; total: number | string; status: InvoiceStatus; due_on: string | null; paid_at: string | null; payment_plan_instalment_id: string | null }>;
  payment_plan_instalments: Array<{ id: string; sequence: number; label: string; percentage: number | string | null; amount: number | string; due_on: string; status: 'draft' | 'issued' | 'paid' | 'overdue'; internal_note: string; paid_at: string | null }>;
};

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  const client = getAdminSupabaseClient();
  const { data, error } = await client.from('orders').select('id, order_number, status, created_at, internal_note, customers(id, first_name, last_name, email, phone, address), order_lines(id, line_kind, display_name, unit_price, quantity, finish, cabinetry_drawings(storage_path, file_name)), invoices(id, invoice_number, total, status, due_on, paid_at, payment_plan_instalment_id), quotes(id, version, status, quote_number, subtotal, discount_total, gst_total, total, expires_on, internal_note, created_at, quote_lines(id, display_name, unit_price, quantity, is_tbd)), payment_plan_instalments(id, sequence, label, percentage, amount, due_on, status, internal_note, paid_at)').eq('id', id).single();
  if (error || !data) throw new Error('Unable to load the order.');
  const row = data as unknown as DetailRow;
  const order = mapAdminOrderRow(row);
  const sourceDrawings = row.order_lines.flatMap((line) => line.cabinetry_drawings ?? []);
  const drawings = await Promise.all(sourceDrawings.map(async (drawing) => {
    const { data: signed } = await client.storage.from('cabinetry-drawings').createSignedUrl(drawing.storage_path, 60 * 10);
    return { fileName: drawing.file_name, signedUrl: signed?.signedUrl ?? null };
  }));
  return {
    order,
    customer: { email: row.customers?.email ?? '', phone: row.customers?.phone ?? '', address: row.customers?.address ?? '' },
    internalNote: row.internal_note,
    lines: row.order_lines.map((line) => ({ id: line.id, name: line.display_name, kind: line.line_kind, unitPrice: line.unit_price === null ? null : Number(line.unit_price), quantity: line.quantity, finish: line.finish })),
    drawings,
    invoices: (row.invoices ?? []).map((invoice) => ({ id: invoice.id, number: invoice.invoice_number, total: Number(invoice.total), status: invoice.status, dueOn: invoice.due_on, paidAt: invoice.paid_at, paymentPlanInstalmentId: invoice.payment_plan_instalment_id })),
    paymentPlan: (row.payment_plan_instalments ?? []).sort((a, b) => a.sequence - b.sequence).map((line) => ({ id: line.id, label: line.label, percentage: line.percentage === null ? 0 : Number(line.percentage), amount: Number(line.amount), dueOn: line.due_on, status: line.status, internalNote: line.internal_note, paidAt: line.paid_at })),
    quotes: row.quotes.map((quote) => ({ id: quote.id, orderId: row.id, version: quote.version, status: quote.status, subtotal: quote.subtotal === null ? undefined : Number(quote.subtotal), discountTotal: quote.discount_total === null ? 0 : Number(quote.discount_total), gstTotal: quote.gst_total === null ? undefined : Number(quote.gst_total), total: Number(quote.total), expiresOn: quote.expires_on, internalNote: quote.internal_note, createdAt: quote.created_at, lines: (quote.quote_lines ?? []).map((line) => ({ id: line.id, displayName: line.display_name, unitPrice: Number(line.unit_price), quantity: line.quantity, isTbd: line.is_tbd })) })).sort((a, b) => b.version - a.version),
  };
}

export function quoteDisplayNameForLines(lines: Array<{ line_kind: 'furniture' | 'cabinetry'; display_name: string }>): string {
  const cabinetry = lines.find((line) => line.line_kind === 'cabinetry' && line.display_name.trim());
  if (!cabinetry) throw new Error('Unable to create quotation.');
  return cabinetry.display_name;
}


function validateQuoteSave(input: QuoteSaveInput) {
  if (!input.expiresOn || !input.lines.length) throw new Error('Unable to save quotation.');
  if (input.lines.some((line) => !line.displayName.trim() || !Number.isInteger(line.quantity) || line.quantity <= 0 || (!line.isTbd && (!Number.isFinite(line.unitPrice) || line.unitPrice < 0)))) throw new Error('Unable to save quotation.');
}

export async function saveQuote(input: QuoteSaveInput): Promise<string> {
  validateQuoteSave(input);
  const client = getAdminSupabaseClient();
  const { data: current, error: currentError } = await client.from('quotes').select('id, version, status, quote_number').eq('id', input.quoteId).eq('order_id', input.orderId).single();
  if (currentError || !current) throw new Error('Unable to save quotation.');
  const totals = calculateQuoteTotals(input.lines.filter((line) => !line.isTbd), input.discountTotal ?? 0);
  let quoteId = current.id;
  let version = current.version;
  if (current.status === 'confirmed') {
    const { data: latest, error: latestError } = await client.from('quotes').select('version').eq('order_id', input.orderId);
    if (latestError) throw new Error('Unable to save quotation.');
    version = Math.max(0, ...(latest ?? []).map((quote) => quote.version)) + 1;
    const { data: created, error: createError } = await client.from('quotes').insert({ order_id: input.orderId, version, status: 'draft', total: totals.total, subtotal: totals.subtotal, discount_total: totals.discountTotal, gst_total: totals.gstTotal, expires_on: input.expiresOn, internal_note: input.internalNote }).select('id').single();
    if (createError || !created) throw new Error('Unable to save quotation.');
    quoteId = created.id;
  } else {
    const { error: updateError } = await client.from('quotes').update({ total: totals.total, subtotal: totals.subtotal, discount_total: totals.discountTotal, gst_total: totals.gstTotal, expires_on: input.expiresOn, internal_note: input.internalNote }).eq('id', quoteId);
    if (updateError) throw new Error('Unable to save quotation.');
    const { error: deleteError } = await client.from('quote_lines').delete().eq('quote_id', quoteId);
    if (deleteError) throw new Error('Unable to save quotation lines.');
  }
  const { error: linesError } = await client.from('quote_lines').insert(input.lines.map((line) => ({ quote_id: quoteId, display_name: line.displayName.trim(), unit_price: line.isTbd ? 0 : line.unitPrice, quantity: line.quantity, is_tbd: line.isTbd })));
  if (linesError) throw new Error('Unable to save quotation lines.');
  if (!current.quote_number || quoteId !== current.id) {
    const { error: numberError } = await client.rpc('ensure_quote_number', { p_quote_id: quoteId });
    if (numberError) throw new Error('Unable to assign quotation number.');
  }
  const { error: eventError } = await client.from('order_status_events').insert({ order_id: input.orderId, status: 'new', note: `Quotation v${version} saved.` });
  if (eventError) throw new Error('Unable to update order history.');
  return quoteId;
}

export async function confirmQuote(orderId: string, quoteId: string): Promise<void> {
  const client = getAdminSupabaseClient();
  const { data: quote, error: quoteError } = await client.from('quotes').select('id, expires_on, quote_lines(display_name, unit_price, quantity, is_tbd)').eq('id', quoteId).eq('order_id', orderId).single();
  if (quoteError || !quote || !quote.expires_on || (quote.quote_lines ?? []).some((line) => line.is_tbd || !line.display_name.trim() || Number(line.unit_price) < 0 || Number(line.quantity) <= 0)) throw new Error('Unable to confirm quotation.');
  const { error: quoteUpdateError } = await client.from('quotes').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', quoteId);
  if (quoteUpdateError) throw new Error('Unable to confirm quotation.');
  const { error: orderError } = await client.from('orders').update({ status: 'quoted' }).eq('id', orderId);
  if (orderError) throw new Error('Unable to update order status.');
  const { error: eventError } = await client.from('order_status_events').insert({ order_id: orderId, status: 'quoted', note: 'Quotation confirmed.' });
  if (eventError) throw new Error('Unable to update order history.');
}
export async function savePaymentPlan(orderId: string, quoteId: string, instalments: PaymentPlanDraft[]): Promise<void> {
  const client = getAdminSupabaseClient();
  const { data: quote, error: quoteError } = await client.from('quotes').select('id, total, status').eq('id', quoteId).eq('order_id', orderId).single();
  if (quoteError || !quote || quote.status !== 'confirmed') throw new Error('A confirmed quote is required.');
  const validation = validatePaymentPlan(instalments, Number(quote.total));
  if (!validation.valid) throw new Error(validation.message);
  const { error } = await client.rpc('replace_payment_plan_and_sync_invoices', { p_order_id: orderId, p_quote_id: quoteId, p_instalments: instalments });
  if (error) throw new Error(error.message === 'Issued instalments cannot be changed.' ? error.message : 'Unable to save the payment plan.');
}export async function markInvoicePaid(invoiceId: string, paidAt: string, internalNote: string): Promise<void> {
  const client = getAdminSupabaseClient();
  const { data: invoice, error: invoiceError } = await client.from('invoices').update({ status: 'paid', paid_at: paidAt }).eq('id', invoiceId).eq('status', 'issued').select('id, order_id, invoice_number, payment_plan_instalment_id').single();
  if (invoiceError || !invoice || !invoice.payment_plan_instalment_id) throw new Error('Unable to mark the invoice as paid.');
  const { error: instalmentError } = await client.from('payment_plan_instalments').update({ status: 'paid', paid_at: paidAt }).eq('id', invoice.payment_plan_instalment_id).eq('status', 'issued');
  if (instalmentError) throw new Error('Unable to mark the instalment as paid.');
  const { count, error: outstandingError } = await client.from('payment_plan_instalments').select('id', { count: 'exact', head: true }).eq('order_id', invoice.order_id).in('status', ['issued', 'overdue']);
  if (outstandingError) throw new Error('Unable to update payment status.');
  const note = internalNote.trim() ? ` Payment note: ${internalNote.trim()}` : '';
  if ((count ?? 0) === 0) { const { error: completeError } = await client.from('orders').update({ status: 'completed' }).eq('id', invoice.order_id); if (completeError) throw new Error('Unable to complete the order.'); const { error: eventError } = await client.from('order_status_events').insert({ order_id: invoice.order_id, status: 'completed', note: `Invoice ${invoice.invoice_number} marked paid; all instalments received.${note}` }); if (eventError) throw new Error('Unable to update order history.'); return; }
  const { error: eventError } = await client.from('order_status_events').insert({ order_id: invoice.order_id, status: 'invoiced', note: `Invoice ${invoice.invoice_number} marked paid.${note}` }); if (eventError) throw new Error('Unable to update order history.');
}
type CustomerRow = { id: string; first_name: string; last_name: string; email: string; phone: string; address: string; auth_user_id: string | null; discount_percent: number | string; orders: Array<{ created_at: string }> };

export function mapAdminCustomerRow(row: CustomerRow): AdminCustomer {
  const latestOrderAt = row.orders.reduce<string | null>((latest, order) => !latest || order.created_at > latest ? order.created_at : latest, null);
  const isRegistered = Boolean(row.auth_user_id);
  return {
    id: row.id, name: `${row.first_name} ${row.last_name}`, email: row.email, phone: row.phone, address: row.address,
    latestOrderAt, orderCount: row.orders.length, accountType: isRegistered ? 'registered' : 'guest',
    discountPercent: isRegistered ? Number(row.discount_percent) : null,
  };
}

export async function listCustomers(query = ''): Promise<AdminCustomer[]> {
  const { data, error } = await getAdminSupabaseClient().from('customers').select('id, first_name, last_name, email, phone, address, auth_user_id, discount_percent, orders(created_at)').order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load customers.');
  const search = query.trim().toLowerCase();
  return ((data ?? []) as unknown as CustomerRow[]).map(mapAdminCustomerRow).filter((customer) => !search || customer.name.toLowerCase().includes(search) || customer.email.toLowerCase().includes(search));
}

export type AdminCustomerDetail = { customer: AdminCustomer; orders: Array<{ id: string; number: string; status: OrderStatus; createdAt: string; total: number | null }>; notes: Array<{ id: string; body: string; createdAt: string }> };

type CustomerDetailRow = Omit<CustomerRow, 'orders'> & {
  orders: Array<{ id: string; order_number: string; status: OrderStatus; created_at: string; order_lines: Array<{ unit_price: number | string | null; quantity: number; line_kind: 'furniture' | 'cabinetry' }>; quotes: Array<{ total: number | string; version: number }> }>;
  customer_notes: Array<{ id: string; body: string; created_at: string }>;
};

export async function getCustomer(id: string): Promise<AdminCustomerDetail> {
  const { data, error } = await getAdminSupabaseClient().from('customers').select('id, first_name, last_name, email, phone, address, auth_user_id, discount_percent, orders(id, order_number, status, created_at, order_lines(unit_price, quantity, line_kind), quotes(total, version)), customer_notes(id, body, created_at)').eq('id', id).single();
  if (error || !data) throw new Error('Unable to load customer.');
  const row = data as unknown as CustomerDetailRow;
  const customer = mapAdminCustomerRow({ ...row, orders: row.orders.map((order) => ({ created_at: order.created_at })) });
  const orders = row.orders.map((order) => {
    const hasCabinetry = order.order_lines.some((line) => line.line_kind === 'cabinetry');
    const latestQuote = order.quotes.reduce<{ total: number | string; version: number } | null>((latest, quote) => !latest || quote.version > latest.version ? quote : latest, null);
    const total = hasCabinetry ? (latestQuote ? Number(latestQuote.total) : null) : order.order_lines.reduce((sum, line) => sum + (line.unit_price === null ? 0 : Number(line.unit_price) * line.quantity), 0);
    return { id: order.id, number: order.order_number, status: order.status, createdAt: order.created_at, total };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { customer, orders, notes: row.customer_notes.map((note) => ({ id: note.id, body: note.body, createdAt: note.created_at })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

export async function addCustomerNote(customerId: string, body: string) {
  if (!body.trim()) throw new Error('A note is required.');
  const { data, error } = await getAdminSupabaseClient().from('customer_notes').insert({ customer_id: customerId, body: body.trim() }).select('id, body, created_at').single();
  if (error || !data) throw new Error('Unable to save the note.');
  return { id: data.id, body: data.body, createdAt: data.created_at };
}

export async function updateCustomerDiscount(customerId: string, discountPercent: number): Promise<void> {
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100%.');
  }
  const { data, error } = await getAdminSupabaseClient().from('customers').update({ discount_percent: discountPercent })
    .eq('id', customerId).not('auth_user_id', 'is', null).select('id').maybeSingle();
  if (error || !data) throw new Error('Unable to update the customer discount.');
}

export type ProductSaveInput = Omit<ManagedProduct, 'id' | 'detailContent'> & { id?: string; imageFile?: File; detailContent: ProductDetailContent };
type ProductColourRow = { id: string; name: string; hex_code: string };
type ProductRow = { id: string; name: string; slug: string; description: string; detail_content?: unknown; price: number | string; category: string; subcategory: string; category_id: string | null; theme_slugs: string[]; image_path: string | null; is_active: boolean; display_order: number; product_finishes: Array<{ name: string; display_order: number; product_colours?: ProductColourRow | ProductColourRow[] | null }> };
type ProductCategoryRow = { id: string; name: string; slug: string; parent_id: string | null; depth: 1 | 2 | 3; display_order: number; is_active: boolean; products?: Array<{ count: number }> };
export function mapManagedCategoryRow(row: ProductCategoryRow): ManagedProductCategory {
  return { id: row.id, name: row.name, slug: row.slug, parentId: row.parent_id, depth: row.depth, displayOrder: row.display_order, isActive: row.is_active, productCount: row.products?.[0]?.count ?? 0 };
}
function categoryPathFor(categoryId: string | null, categories: ManagedProductCategory[]) {
  if (!categoryId) return [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const path: string[] = []; const visited = new Set<string>(); let current = categoryById.get(categoryId);
  while (current && !visited.has(current.id)) { path.unshift(current.name); visited.add(current.id); current = current.parentId ? categoryById.get(current.parentId) : undefined; }
  return path;
}
export function mapManagedProductRow(row: ProductRow, categories: ManagedProductCategory[] = []): ManagedProduct {
  const categoryPath = categoryPathFor(row.category_id, categories);
  const orderedFinishes = [...row.product_finishes].sort((a, b) => a.display_order - b.display_order);
  const colours = orderedFinishes.flatMap((finish) => { const colour = Array.isArray(finish.product_colours) ? finish.product_colours[0] : finish.product_colours; return colour ? [{ id: colour.id, name: colour.name, hexCode: colour.hex_code }] : []; });
  return { id: row.id, name: row.name, slug: row.slug, description: row.description, detailContent: normaliseProductDetailContent(row.detail_content), price: Number(row.price), category: categoryPath[0] ?? row.category, subcategory: categoryPath.slice(1).join(' / ') || row.subcategory, categoryId: row.category_id, categoryPath, themeSlugs: row.theme_slugs, finishes: orderedFinishes.map((finish) => finish.name), colours, imagePath: row.image_path, isActive: row.is_active, displayOrder: row.display_order };
}
function managedProductPresentationKey(product: ManagedProduct, categories: ManagedProductCategory[], styleRanges: ManagedStyleRange[]) {
  const rangesBySlug = new Map(styleRanges.map((range) => [range.slug, range]));
  const firstRange = product.themeSlugs.map((slug) => rangesBySlug.get(slug)).filter((range): range is ManagedStyleRange => Boolean(range)).sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))[0];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const path: ManagedProductCategory[] = [];
  let current = product.categoryId ? categoriesById.get(product.categoryId) : undefined;
  while (current) { path.unshift(current); current = current.parentId ? categoriesById.get(current.parentId) : undefined; }
  const [l1, l2, l3] = path;
  return [firstRange?.displayOrder ?? Number.MAX_SAFE_INTEGER, firstRange?.id ?? '', l1?.displayOrder ?? Number.MAX_SAFE_INTEGER, l1?.id ?? '', l2?.displayOrder ?? Number.MAX_SAFE_INTEGER, l2?.id ?? '', l3?.displayOrder ?? Number.MAX_SAFE_INTEGER, l3?.id ?? ''] as const;
}
export function sortManagedProductsByPresentation(products: ManagedProduct[], categories: ManagedProductCategory[], styleRanges: ManagedStyleRange[]): ManagedProduct[] {
  return [...products].sort((left, right) => {
    const leftKey = managedProductPresentationKey(left, categories, styleRanges); const rightKey = managedProductPresentationKey(right, categories, styleRanges);
    for (let index = 0; index < leftKey.length; index += 1) { if (leftKey[index] < rightKey[index]) return -1; if (leftKey[index] > rightKey[index]) return 1; }
    return left.displayOrder - right.displayOrder || left.id.localeCompare(right.id);
  });
}
const managedProductFields = 'id, name, slug, description, detail_content, price, category, subcategory, category_id, theme_slugs, image_path, is_active, display_order, product_finishes(name, display_order, product_colours(id, name, hex_code))';
export async function listManagedProductColours(): Promise<ProductColour[]> {
  const { data, error } = await getAdminSupabaseClient().from('product_colours').select('id, name, hex_code').order('name');
  if (error) throw new Error('Unable to load colours.');
  return (data ?? []).map((colour) => ({ id: colour.id, name: colour.name, hexCode: colour.hex_code }));
}
export async function createManagedProductColour(input: Omit<ProductColour, 'id'>): Promise<ProductColour> {
  const name = input.name.trim(); const hexCode = input.hexCode.trim().toUpperCase();
  if (!name || !/^#[0-9A-F]{6}$/.test(hexCode)) throw new Error('Enter a colour name and a six-digit hex code.');
  const { data, error } = await getAdminSupabaseClient().from('product_colours').insert({ name, hex_code: hexCode }).select('id, name, hex_code').single();
  if (error || !data) throw new Error(error?.code === '23505' ? 'This colour already exists.' : 'Unable to create colour.');
  return { id: data.id, name: data.name, hexCode: data.hex_code };
}
export async function listManagedCategories(): Promise<ManagedProductCategory[]> {
  const { data, error } = await getAdminSupabaseClient().from('product_categories').select('id, name, slug, parent_id, depth, display_order, is_active, products(count)').order('depth').order('display_order').order('name');
  if (error) throw new Error('Unable to load product categories.');
  return ((data ?? []) as unknown as ProductCategoryRow[]).map(mapManagedCategoryRow);
}
export type ProductCategorySaveInput = Omit<ManagedProductCategory, 'id' | 'productCount'> & { id?: string };
export async function saveManagedCategory(input: ProductCategorySaveInput): Promise<ManagedProductCategory> {
  const name = input.name.trim(); const slug = input.slug.trim().toLowerCase();
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Enter a category name and URL-safe slug.');
  if (input.depth === 1 && input.parentId) throw new Error('Top-level categories cannot have a parent.');
  if (input.depth > 1 && !input.parentId) throw new Error('Nested categories require a parent.');
  const values = { name, slug, parent_id: input.parentId, depth: input.depth, display_order: input.displayOrder, is_active: input.isActive };
  const query = input.id ? getAdminSupabaseClient().from('product_categories').update(values).eq('id', input.id) : getAdminSupabaseClient().from('product_categories').insert(values);
  const { data, error } = await query.select('id, name, slug, parent_id, depth, display_order, is_active, products(count)').single();
  if (error || !data) throw new Error(error?.code === '23505' ? 'A category with this name or slug already exists.' : 'Unable to save product category.');
  return mapManagedCategoryRow(data as unknown as ProductCategoryRow);
}
export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await getAdminSupabaseClient().from('product_categories').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error('Unable to update product category.');
}
export async function deleteManagedCategory(id: string): Promise<void> {
  const client = getAdminSupabaseClient();
  const [{ data: children, error: childrenError }, { data: products, error: productsError }] = await Promise.all([
    client.from('product_categories').select('id').eq('parent_id', id).limit(1),
    client.from('products').select('id').eq('category_id', id).limit(1),
  ]);
  if (childrenError || productsError) throw new Error('Unable to check category usage.');
  if (children?.length) throw new Error('Delete or move its child categories first.');
  if (products?.length) throw new Error('Move or delete its products first.');
  const { error } = await client.from('product_categories').delete().eq('id', id);
  if (error) throw new Error('Unable to delete product category.');
}
export async function listManagedProducts(): Promise<ManagedProduct[]> {
  const client = getAdminSupabaseClient(); const [{ data, error }, categories, styleRanges] = await Promise.all([client.from('products').select(managedProductFields).order('display_order').order('name'), listManagedCategories(), listManagedStyleRanges()]);
  if (error) throw new Error('Unable to load products.');
  return sortManagedProductsByPresentation(((data ?? []) as unknown as ProductRow[]).map((row) => mapManagedProductRow(row, categories)), categories, styleRanges);
}
export async function saveProduct(input: ProductSaveInput): Promise<ManagedProduct> {
  const client = getAdminSupabaseClient(); const values = { name: input.name, slug: input.slug, description: input.description, detail_content: input.detailContent, price: input.price, category: input.category, subcategory: input.subcategory, category_id: input.categoryId, theme_slugs: input.themeSlugs, image_path: input.imagePath, is_active: input.isActive };
  const query = input.id ? client.from('products').update({ ...values, display_order: input.displayOrder }).eq('id', input.id) : client.from('products').insert(values);
  const { data, error } = await query.select('id').single();
  if (error || !data) { if (error?.code === '23505') throw new Error('This URL slug is already in use.'); throw new Error('Unable to save product.'); }
  const { error: deleteError } = await client.from('product_finishes').delete().eq('product_id', data.id);
  if (deleteError) throw new Error('Unable to update product finishes.');
  const colours = input.colours ?? [];
  if (colours.length) { const { error: finishError } = await client.from('product_finishes').insert(colours.map((colour, displayOrder) => ({ product_id: data.id, colour_id: colour.id, name: colour.name, display_order: displayOrder }))); if (finishError) throw new Error('Unable to update product finishes.'); }
  const { data: product, error: productError } = await client.from('products').select(managedProductFields).eq('id', data.id).single();
  if (productError || !product) throw new Error('Unable to load saved product.');
  return mapManagedProductRow(product as unknown as ProductRow, await listManagedCategories());
}
export async function archiveProduct(id: string): Promise<void> {
  const { error } = await getAdminSupabaseClient().from('products').update({ is_active: false }).eq('id', id);
  if (error) throw new Error('Unable to archive product.');
}
export async function deleteProduct(id: string): Promise<void> {
  const client = getAdminSupabaseClient();
  const { data: orderLines, error: usageError } = await client.from('order_lines').select('id').eq('product_id', id).limit(1);
  if (usageError) throw new Error('Unable to check product history.');
  if (orderLines?.length) throw new Error('Products with order history can only be archived.');
  const { error } = await client.from('products').delete().eq('id', id);
  if (error) throw new Error('Unable to delete product.');
}
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error('Use a JPG, PNG or WebP product image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Product images must be under 10 MB.');
  const optimisedFile = await compressPublicImage(file);
  const optimisedExtension = optimisedFile.name.split('.').pop()?.toLowerCase() ?? extension;
  const path = `${productId}/${crypto.randomUUID()}.${optimisedExtension}`;
  const { error } = await getAdminSupabaseClient().storage.from('product-assets').upload(path, optimisedFile, { contentType: optimisedFile.type, upsert: false });
  if (error) throw new Error('Unable to upload product image.');
  return path;
}

export function validateImageFile(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > 10 * 1024 * 1024) return 'Images must be under 10 MB.';
  return null;
}

async function uploadPublicImage(bucket: 'site-assets' | 'product-assets' | 'project-assets' | 'blog-assets', ownerId: string, file: File): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  const optimisedFile = await compressPublicImage(file);
  const extension = optimisedFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getAdminSupabaseClient().storage.from(bucket).upload(path, optimisedFile, { contentType: optimisedFile.type, upsert: false });
  if (error) throw new Error('Unable to upload image.');
  return path;
}

export function publicAssetUrl(bucket: 'site-assets' | 'product-assets' | 'project-assets' | 'blog-assets', path: string | null): string | null {
  if (!path) return null;
  return getAdminSupabaseClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function uploadProjectImage(projectId: string, file: File): Promise<string> { return uploadPublicImage('project-assets', projectId, file); }
export function uploadBlogImage(postId: string, file: File): Promise<string> { return uploadPublicImage('blog-assets', postId, file); }
export function uploadSiteImage(ownerId: string, file: File): Promise<string> { return uploadPublicImage('site-assets', ownerId, file); }

export type ProjectSaveInput = { id?: string; name: string; slug: string; location: string; introduction: string; style: string; coverImagePath: string | null; coverImageFile?: File; isActive: boolean; displayOrder: number; gallery: Array<{ id: string; path: string; sortOrder: number; file?: File; previewSrc?: string }> };
type ProjectRow = { id: string; name: string; slug: string; location: string; introduction: string; style: string; cover_image_path: string | null; is_active: boolean; display_order: number; project_images?: Array<{ id: string; path: string; display_order: number }> };
function mapManagedProjectRow(row: ProjectRow): ManagedProject { return { id: row.id, name: row.name, slug: row.slug, location: row.location, introduction: row.introduction, coverImagePath: row.cover_image_path, isActive: row.is_active, displayOrder: row.display_order }; }
export async function listManagedProjects(): Promise<ManagedProject[]> { const { data, error } = await getAdminSupabaseClient().from('projects').select('id, name, slug, location, introduction, cover_image_path, is_active, display_order').order('display_order').order('name'); if (error) throw new Error('Unable to load projects.'); return ((data ?? []) as ProjectRow[]).map(mapManagedProjectRow); }
export async function getManagedProject(id: string): Promise<ProjectSaveInput> { const { data, error } = await getAdminSupabaseClient().from('projects').select('id, name, slug, location, introduction, style, cover_image_path, is_active, display_order, project_images(id, path, display_order)').eq('id', id).single(); if (error || !data) throw new Error('Unable to load project.'); const row = data as ProjectRow; return { id: row.id, name: row.name, slug: row.slug, location: row.location, introduction: row.introduction, style: row.style, coverImagePath: row.cover_image_path, isActive: row.is_active, displayOrder: row.display_order, gallery: (row.project_images ?? []).sort((a, b) => a.display_order - b.display_order).map((image, sortOrder) => ({ id: image.id, path: image.path, sortOrder })) }; }
export async function saveManagedProject(input: ProjectSaveInput): Promise<{ id: string }> { const client = getAdminSupabaseClient(); const values = { name: input.name, slug: input.slug, location: input.location, introduction: input.introduction, style: input.style, cover_image_path: input.coverImagePath, is_active: input.isActive, display_order: input.displayOrder }; const query = input.id ? client.from('projects').update(values).eq('id', input.id) : client.from('projects').insert(values); const { data, error } = await query.select('id').single(); if (error || !data) throw new Error('Unable to save project.'); const { error: clearError } = await client.from('project_images').delete().eq('project_id', data.id); if (clearError) throw new Error('Unable to update project gallery.'); if (input.gallery.length) { const { error: galleryError } = await client.from('project_images').insert(input.gallery.map((image, displayOrder) => ({ project_id: data.id, path: image.path, display_order: displayOrder }))); if (galleryError) throw new Error('Unable to update project gallery.'); } return { id: data.id }; }
export async function archiveManagedProject(id: string): Promise<void> { const { error } = await getAdminSupabaseClient().from('projects').update({ is_active: false }).eq('id', id); if (error) throw new Error('Unable to archive project.'); }
export async function deleteManagedProject(id: string): Promise<void> { const { error } = await getAdminSupabaseClient().from('projects').delete().eq('id', id); if (error) throw new Error('Unable to delete project.'); }

export type BlogSaveInput = Omit<BlogPost, 'id'> & { id?: string; coverImageFile?: File };
type BlogRow = { id: string; title: string; slug: string; excerpt: string; body: string; cover_image_path: string | null; publication_date: string; status: BlogStatus; post_type: BlogPost['postType']; destination_url: string | null; blog_social_links: Array<{ platform: 'instagram' | 'facebook' | 'xiaohongshu'; url: string }> };
function mapBlogRow(row: BlogRow): BlogPost { return { id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt, body: row.body, coverImagePath: row.cover_image_path, publicationDate: row.publication_date, status: row.status, postType: row.post_type, destinationUrl: row.destination_url, socialLinks: Object.fromEntries(row.blog_social_links.map((link) => [link.platform, link.url])) }; }
export async function listManagedBlogPosts(): Promise<BlogPost[]> { const { data, error } = await getAdminSupabaseClient().from('blog_posts').select('id, title, slug, excerpt, body, cover_image_path, publication_date, status, post_type, destination_url, blog_social_links(platform, url)').order('publication_date', { ascending: false }); if (error) throw new Error('Unable to load blog posts.'); return ((data ?? []) as BlogRow[]).map(mapBlogRow); }
export async function saveBlogPost(input: BlogSaveInput): Promise<{ id: string }> { const client = getAdminSupabaseClient(); const values = { title: input.title, slug: input.slug, excerpt: input.excerpt, body: input.body, cover_image_path: input.coverImagePath, publication_date: input.publicationDate, status: input.status, post_type: input.postType, destination_url: input.destinationUrl?.trim() || null }; const query = input.id ? client.from('blog_posts').update(values).eq('id', input.id) : client.from('blog_posts').insert(values); const { data, error } = await query.select('id').single(); if (error || !data) throw new Error('Unable to save blog post.'); const { error: clearError } = await client.from('blog_social_links').delete().eq('post_id', data.id); if (clearError) throw new Error('Unable to update social links.'); const links = Object.entries(input.socialLinks).filter((entry): entry is ['instagram' | 'facebook' | 'xiaohongshu', string] => typeof entry[1] === 'string' && Boolean(entry[1].trim())); if (links.length) { const { error: linksError } = await client.from('blog_social_links').insert(links.map(([platform, url]) => ({ post_id: data.id, platform, url }))); if (linksError) throw new Error('Unable to update social links.'); } return { id: data.id }; }
export async function archiveBlogPost(id: string): Promise<void> { const { error } = await getAdminSupabaseClient().from('blog_posts').update({ status: 'archived' }).eq('id', id); if (error) throw new Error('Unable to archive blog post.'); }
export async function deleteBlogPost(id: string): Promise<void> { const { error } = await getAdminSupabaseClient().from('blog_posts').delete().eq('id', id); if (error) throw new Error('Unable to delete blog post.'); }
export type DashboardSummary = { newOrders:number; quotePending:number; activeProducts:number; activeProjects:number; publishedPosts:number };
export async function getDashboardSummary(): Promise<DashboardSummary> { const c=getAdminSupabaseClient(); const [o,q,p,r,b]=await Promise.all([c.from('orders').select('*',{count:'exact',head:true}).eq('status','new'),c.from('orders').select('*',{count:'exact',head:true}).eq('status','quoted'),c.from('products').select('*',{count:'exact',head:true}).eq('is_active',true),c.from('projects').select('*',{count:'exact',head:true}).eq('is_active',true),c.from('blog_posts').select('*',{count:'exact',head:true}).eq('status','published')]); if([o,q,p,r,b].some(x=>x.error)) throw new Error('Unable to load dashboard.'); return {newOrders:o.count??0,quotePending:q.count??0,activeProducts:p.count??0,activeProjects:r.count??0,publishedPosts:b.count??0}; }
export async function getSettings(){const {data,error}=await getAdminSupabaseClient().from('site_settings').select('studio_address, studio_email, studio_phone, invoice_prefix').single();if(error||!data)throw new Error('Unable to load settings.');return {studioAddress:data.studio_address,studioEmail:data.studio_email,studioPhone:data.studio_phone,invoicePrefix:data.invoice_prefix};}
export async function saveSettings(v:{studioAddress:string;studioEmail:string;studioPhone:string;invoicePrefix:string}){const {error}=await getAdminSupabaseClient().from('site_settings').update({studio_address:v.studioAddress,studio_email:v.studioEmail,studio_phone:v.studioPhone,invoice_prefix:v.invoicePrefix}).eq('id',true);if(error)throw new Error('Unable to save settings.');}

type HomeContentRow = { hero_eyebrow: string; hero_heading: string; hero_cta_label: string; hero_cta_path: string; hero_image_path: string | null };
type ServicePillarRow = { id: string; title: string; description: string; icon_key: ManagedServicePillar['iconKey']; display_order: number; is_active: boolean };
type StyleRangeRow = { id: string; slug: string; name: string; eyebrow: string; headline: string; description: string; hero_image_path: string | null; room_image_path: string | null; palette: string[]; display_order: number; is_active: boolean };
type HomeThemeBlockRow = { id: string; style_range_id: string; eyebrow: string; headline: string; description: string; image_path: string | null; display_order: number; is_active: boolean; style_ranges: { slug: string; name: string } | Array<{ slug: string; name: string }> };
type PaletteItemRow = { id: string; style_range_id: string; name: string; colour: string; image_path: string | null; display_order: number; is_active: boolean };
type CabinetryProductRow = { id: string; style_range_id: string; eyebrow: string; headline: string; description: string; detail_content?: unknown; scope: string; hero_image_path: string | null; is_active: boolean; style_ranges: { slug: string; name: string } | Array<{ slug: string; name: string }>; cabinetry_product_images: Array<{ id: string; cabinetry_product_id: string; image_path: string; display_order: number; is_active: boolean }> };

function mapManagedHomeContentRow(row: HomeContentRow): ManagedHomeContent { return { heroEyebrow: row.hero_eyebrow, heroHeading: row.hero_heading, heroCtaLabel: row.hero_cta_label, heroCtaPath: row.hero_cta_path, heroImagePath: row.hero_image_path }; }
function mapManagedServicePillarRow(row: ServicePillarRow): ManagedServicePillar { return { id: row.id, title: row.title, description: row.description, iconKey: row.icon_key, displayOrder: row.display_order, isActive: row.is_active }; }
function mapManagedStyleRangeRow(row: StyleRangeRow): ManagedStyleRange { return { id: row.id, slug: row.slug, name: row.name, eyebrow: row.eyebrow, headline: row.headline, description: row.description, heroImagePath: row.hero_image_path, roomImagePath: row.room_image_path, palette: row.palette, displayOrder: row.display_order, isActive: row.is_active }; }
function mapManagedHomeThemeBlockRow(row: HomeThemeBlockRow): ManagedHomeThemeBlock { const range = Array.isArray(row.style_ranges) ? row.style_ranges[0] : row.style_ranges; return { id: row.id, styleRangeId: row.style_range_id, rangeSlug: range.slug, rangeName: range.name, eyebrow: row.eyebrow, headline: row.headline, description: row.description, imagePath: row.image_path, displayOrder: row.display_order, isActive: row.is_active }; }
function mapManagedPaletteItemRow(row: PaletteItemRow): ManagedPaletteItem { return { id: row.id, styleRangeId: row.style_range_id, name: row.name, colour: row.colour, imagePath: row.image_path, displayOrder: row.display_order, isActive: row.is_active }; }
function mapManagedCabinetryImageRow(row: CabinetryProductRow['cabinetry_product_images'][number]): ManagedCabinetryImage { return { id: row.id, cabinetryProductId: row.cabinetry_product_id, imagePath: row.image_path, displayOrder: row.display_order, isActive: row.is_active }; }
function mapManagedCabinetryProductRow(row: CabinetryProductRow): ManagedCabinetryProduct { const range = Array.isArray(row.style_ranges) ? row.style_ranges[0] : row.style_ranges; return { id: row.id, styleRangeId: row.style_range_id, rangeSlug: range.slug, rangeName: range.name, eyebrow: row.eyebrow, headline: row.headline, description: row.description, detailContent: normaliseProductDetailContent(row.detail_content), scope: row.scope, heroImagePath: row.hero_image_path, isActive: row.is_active, images: [...(row.cabinetry_product_images ?? [])].sort((a, b) => a.display_order - b.display_order).map(mapManagedCabinetryImageRow) }; }

export async function getManagedHomeContent(): Promise<ManagedHomeContent | null> { const { data, error } = await getAdminSupabaseClient().from('home_page_content').select('hero_eyebrow, hero_heading, hero_cta_label, hero_cta_path, hero_image_path').eq('id', true).maybeSingle(); if (error) throw new Error('Unable to load homepage content.'); return data ? mapManagedHomeContentRow(data as HomeContentRow) : null; }
export async function saveManagedHomeContent(input: ManagedHomeContent): Promise<void> { if (!input.heroHeading.trim() || !input.heroCtaLabel.trim() || !input.heroCtaPath.startsWith('/')) throw new Error('Enter a heading, CTA label and public route path.'); const { error } = await getAdminSupabaseClient().from('home_page_content').upsert({ id: true, hero_eyebrow: input.heroEyebrow.trim(), hero_heading: input.heroHeading.trim(), hero_cta_label: input.heroCtaLabel.trim(), hero_cta_path: input.heroCtaPath.trim(), hero_image_path: input.heroImagePath }); if (error) throw new Error('Unable to save homepage content.'); }
export async function listManagedServicePillars(): Promise<ManagedServicePillar[]> { const { data, error } = await getAdminSupabaseClient().from('home_service_pillars').select('id, title, description, icon_key, display_order, is_active').order('display_order'); if (error) throw new Error('Unable to load homepage services.'); return (data ?? []).map((row) => mapManagedServicePillarRow(row as ServicePillarRow)); }
export async function saveManagedServicePillar(input: Omit<ManagedServicePillar, 'id'> & { id?: string }): Promise<ManagedServicePillar> { if (!input.title.trim()) throw new Error('Enter a service title.'); const values = { title: input.title.trim(), description: input.description.trim(), icon_key: input.iconKey, display_order: input.displayOrder, is_active: input.isActive }; const query = input.id ? getAdminSupabaseClient().from('home_service_pillars').update(values).eq('id', input.id) : getAdminSupabaseClient().from('home_service_pillars').insert(values); const { data, error } = await query.select('id, title, description, icon_key, display_order, is_active').single(); if (error || !data) throw new Error('Unable to save homepage service.'); return mapManagedServicePillarRow(data as ServicePillarRow); }
export async function setServicePillarActive(id: string, isActive: boolean): Promise<void> { const { error } = await getAdminSupabaseClient().from('home_service_pillars').update({ is_active: isActive }).eq('id', id); if (error) throw new Error('Unable to update homepage service.'); }
export async function listManagedStyleRanges(): Promise<ManagedStyleRange[]> { const { data, error } = await getAdminSupabaseClient().from('style_ranges').select('id, slug, name, eyebrow, headline, description, hero_image_path, room_image_path, palette, display_order, is_active').order('display_order'); if (error) throw new Error('Unable to load product ranges.'); return (data ?? []).map((row) => mapManagedStyleRangeRow(row as StyleRangeRow)); }
export async function saveManagedStyleRange(input: Omit<ManagedStyleRange, 'id'> & { id?: string }): Promise<ManagedStyleRange> { const slug = input.slug.trim().toLowerCase(); const palette = input.palette.map((colour) => colour.trim()); if (!input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || palette.length !== 5 || palette.some((colour) => !/^#[0-9a-f]{6}$/i.test(colour))) throw new Error('Enter a name, URL-safe slug and five hex palette colours.'); const values = { slug, name: input.name.trim(), eyebrow: input.eyebrow.trim(), headline: input.headline.trim(), description: input.description.trim(), hero_image_path: input.heroImagePath, room_image_path: input.roomImagePath, palette, display_order: input.displayOrder, is_active: input.isActive }; const query = input.id ? getAdminSupabaseClient().from('style_ranges').update(values).eq('id', input.id) : getAdminSupabaseClient().from('style_ranges').insert(values); const { data, error } = await query.select('id, slug, name, eyebrow, headline, description, hero_image_path, room_image_path, palette, display_order, is_active').single(); if (error || !data) throw new Error(error?.code === '23505' ? 'This range slug is already in use.' : 'Unable to save product range.'); return mapManagedStyleRangeRow(data as StyleRangeRow); }
export async function setStyleRangeActive(id: string, isActive: boolean): Promise<void> { const { error } = await getAdminSupabaseClient().from('style_ranges').update({ is_active: isActive }).eq('id', id); if (error) throw new Error('Unable to update product range.'); }

export type HomeThemeBlockSaveInput = Omit<ManagedHomeThemeBlock, 'id' | 'rangeSlug' | 'rangeName'> & { id?: string };
const managedHomeThemeBlockFields = 'id, style_range_id, eyebrow, headline, description, image_path, display_order, is_active, style_ranges!inner(slug, name)';
export async function listManagedHomeThemeBlocks(): Promise<ManagedHomeThemeBlock[]> { const { data, error } = await getAdminSupabaseClient().from('home_theme_blocks').select(managedHomeThemeBlockFields).order('display_order'); if (error) throw new Error('Unable to load homepage theme blocks.'); return (data ?? []).map((row) => mapManagedHomeThemeBlockRow(row as HomeThemeBlockRow)); }
export async function saveManagedHomeThemeBlock(input: HomeThemeBlockSaveInput): Promise<ManagedHomeThemeBlock> { if (!input.styleRangeId || !input.headline.trim() || !input.description.trim()) throw new Error('Choose a range and enter a heading and description.'); const values = { style_range_id: input.styleRangeId, eyebrow: input.eyebrow.trim(), headline: input.headline.trim(), description: input.description.trim(), image_path: input.imagePath, display_order: input.displayOrder, is_active: input.isActive }; const query = input.id ? getAdminSupabaseClient().from('home_theme_blocks').update(values).eq('id', input.id) : getAdminSupabaseClient().from('home_theme_blocks').insert(values); const { data, error } = await query.select(managedHomeThemeBlockFields).single(); if (error || !data) throw new Error(error?.code === '23505' ? 'This range already has a homepage theme block.' : 'Unable to save homepage theme block.'); return mapManagedHomeThemeBlockRow(data as HomeThemeBlockRow); }
export async function setHomeThemeBlockActive(id: string, isActive: boolean): Promise<void> { const { error } = await getAdminSupabaseClient().from('home_theme_blocks').update({ is_active: isActive }).eq('id', id); if (error) throw new Error('Unable to update homepage theme block.'); }

export type PaletteItemSaveInput = Omit<ManagedPaletteItem, 'id'> & { id?: string };
export async function listManagedPaletteItems(styleRangeId: string): Promise<ManagedPaletteItem[]> { const { data, error } = await getAdminSupabaseClient().from('style_range_palette_items').select('id, style_range_id, name, colour, image_path, display_order, is_active').eq('style_range_id', styleRangeId).order('display_order'); if (error) throw new Error('Unable to load palette items.'); return (data ?? []).map((row) => mapManagedPaletteItemRow(row as PaletteItemRow)); }
export async function saveManagedPaletteItem(input: PaletteItemSaveInput): Promise<ManagedPaletteItem> { const name = input.name.trim(); const colour = input.colour.trim(); if (!name || !/^#[0-9a-f]{6}$/i.test(colour)) throw new Error('Enter a palette name and a hex colour.'); const values = { style_range_id: input.styleRangeId, name, colour: colour.toUpperCase(), image_path: input.imagePath, display_order: input.displayOrder, is_active: input.isActive }; const query = input.id ? getAdminSupabaseClient().from('style_range_palette_items').update(values).eq('id', input.id) : getAdminSupabaseClient().from('style_range_palette_items').insert(values); const { data, error } = await query.select('id, style_range_id, name, colour, image_path, display_order, is_active').single(); if (error || !data) throw new Error('Unable to save palette item.'); return mapManagedPaletteItemRow(data as PaletteItemRow); }
export async function setPaletteItemActive(id: string, isActive: boolean): Promise<void> { const { error } = await getAdminSupabaseClient().from('style_range_palette_items').update({ is_active: isActive }).eq('id', id); if (error) throw new Error('Unable to update palette item.'); }
export async function deleteManagedPaletteItem(id: string): Promise<void> { const { error } = await getAdminSupabaseClient().from('style_range_palette_items').delete().eq('id', id); if (error) throw new Error('Unable to delete palette item.'); }

export type CabinetryProductSaveInput = Omit<ManagedCabinetryProduct, 'rangeSlug' | 'rangeName' | 'images'>;
const cabinetryProductFields = 'id, style_range_id, eyebrow, headline, description, detail_content, scope, hero_image_path, is_active, style_ranges!inner(slug, name), cabinetry_product_images(id, cabinetry_product_id, image_path, display_order, is_active)';
export async function listManagedCabinetryProducts(): Promise<ManagedCabinetryProduct[]> { const { data, error } = await getAdminSupabaseClient().from('cabinetry_products').select(cabinetryProductFields).order('style_range_id'); if (error) throw new Error('Unable to load quote-based products.'); return (data ?? []).map((row) => mapManagedCabinetryProductRow(row as unknown as CabinetryProductRow)); }
export async function getManagedCabinetryProduct(styleRangeId: string): Promise<ManagedCabinetryProduct | null> { const { data, error } = await getAdminSupabaseClient().from('cabinetry_products').select(cabinetryProductFields).eq('style_range_id', styleRangeId).maybeSingle(); if (error) throw new Error('Unable to load cabinetry product.'); return data ? mapManagedCabinetryProductRow(data as unknown as CabinetryProductRow) : null; }
export async function saveManagedCabinetryProduct(input: CabinetryProductSaveInput): Promise<void> { if (!input.eyebrow.trim() || !input.headline.trim() || !input.description.trim() || !input.scope.trim()) throw new Error('Enter a label, heading, description and project scope.'); const { error } = await getAdminSupabaseClient().from('cabinetry_products').update({ eyebrow: input.eyebrow.trim(), headline: input.headline.trim(), description: input.description.trim(), detail_content: normaliseProductDetailContent(input.detailContent), scope: input.scope.trim(), hero_image_path: input.heroImagePath, is_active: input.isActive }).eq('id', input.id).eq('style_range_id', input.styleRangeId); if (error) throw new Error('Unable to save cabinetry product.'); }
export async function replaceManagedCabinetryImages(cabinetryProductId: string, imagePaths: string[]): Promise<void> { const client = getAdminSupabaseClient(); const { error: clearError } = await client.from('cabinetry_product_images').delete().eq('cabinetry_product_id', cabinetryProductId); if (clearError) throw new Error('Unable to update cabinetry gallery.'); if (!imagePaths.length) return; const { error } = await client.from('cabinetry_product_images').insert(imagePaths.map((imagePath, displayOrder) => ({ cabinetry_product_id: cabinetryProductId, image_path: imagePath, display_order: displayOrder, is_active: true }))); if (error) throw new Error('Unable to update cabinetry gallery.'); }

export type SampleImportResult = { created: number; skipped: number; failed: number; recordsCreated: number; recordsSkipped: number };
async function fetchSampleFile(sourceUrl: string, destination: string) { const response = await fetch(sourceUrl); if (!response.ok) throw new Error(`Unable to read ${destination}.`); const blob = await response.blob(); return new File([blob], destination.split('/').at(-1) ?? 'sample.png', { type: blob.type || 'image/png' }); }
const categorySlugForSample = (category: string, slug: string) => ({
  'nagi-side-table': 'side-table',
  'hoku-dining-table': 'dining-table',
  'koto-dining-chair': 'dining-chair',
  'sora-platform-bed': 'beds',
  'mizu-bedside-table': 'bedside-table',
}[slug] ?? (category === 'seating' ? 'sofa' : category === 'tables' ? 'coffee-table' : slug === 'nami-pendant-light' ? 'pendant' : slug === 'aki-wall-sconce' ? 'wall-lights' : category === 'lighting' ? 'lamps' : 'side-table'));
export async function importExistingSampleContent(): Promise<SampleImportResult> { const client = getAdminSupabaseClient(); const [assets, records] = await Promise.all([loadExistingSampleAssets(), loadExistingSampleRecords()]); let created = 0; let skipped = 0; let failed = 0; for (const asset of assets) { try { const target = asset.owner === 'home' ? await client.from('home_page_content').select('hero_image_path').eq('id', true).maybeSingle() : await client.from('style_ranges').select(asset.field).eq('slug', asset.owner).maybeSingle(); const currentPath = target.data && asset.field in target.data ? (target.data as Record<string, string | null>)[asset.field] : null; if (currentPath) { skipped += 1; continue; } const file = await fetchSampleFile(asset.sourceUrl, asset.destination); const { error: uploadError } = await client.storage.from(asset.bucket).upload(asset.destination, file, { contentType: file.type, upsert: false }); if (uploadError && !/already exists/i.test(uploadError.message)) throw uploadError; const update = asset.owner === 'home' ? client.from('home_page_content').update({ [asset.field]: asset.destination }).eq('id', true).is(asset.field, null) : client.from('style_ranges').update({ [asset.field]: asset.destination }).eq('slug', asset.owner).is(asset.field, null); const { error: updateError } = await update; if (updateError) throw updateError; created += 1; } catch { failed += 1; } }
  const { data: categories, error: categoryError } = await client.from('product_categories').select('id, slug'); if (categoryError) throw new Error('Unable to import sample categories.'); const categoryIds = new Map((categories ?? []).map((category) => [category.slug as string, category.id as string]));
  const { data: importedProducts, error: productError } = await client.from('products').upsert(records.products.map((product, index) => ({ name: product.name, slug: product.slug, description: product.description, price: product.price, category: product.category, subcategory: '', category_id: categoryIds.get(categorySlugForSample(product.category, product.slug)) ?? null, theme_slugs: product.themeSlugs, image_tone: product.imageTone, is_active: true, display_order: index + 1 })), { onConflict: 'slug', ignoreDuplicates: true }).select('id, slug'); if (productError) throw new Error('Unable to import sample products.'); const { data: allProducts, error: allProductsError } = await client.from('products').select('id, slug').in('slug', records.products.map((product) => product.slug)); if (allProductsError) throw new Error('Unable to import sample product finishes.'); const productIds = new Map((allProducts ?? []).map((product) => [product.slug as string, product.id as string])); const finishRows = records.products.flatMap((product) => product.finishes.map((name, index) => ({ product_id: productIds.get(product.slug), name, display_order: index + 1 }))).filter((finish): finish is { product_id: string; name: string; display_order: number } => Boolean(finish.product_id)); const { error: finishError } = await client.from('product_finishes').upsert(finishRows, { onConflict: 'product_id,name', ignoreDuplicates: true }); if (finishError) throw new Error('Unable to import sample product finishes.');
  const { data: importedProjects, error: projectError } = await client.from('projects').upsert(records.projects.map((project, index) => ({ name: project.name, slug: project.slug, location: project.location, introduction: project.introduction, style: project.style, image_tone: project.imageTone, is_active: true, display_order: index + 1 })), { onConflict: 'slug', ignoreDuplicates: true }).select('id'); if (projectError) throw new Error('Unable to import sample projects.'); const { data: importedPosts, error: postError } = await client.from('blog_posts').upsert(records.posts.map((post) => ({ title: post.title, slug: post.slug, excerpt: post.excerpt, body: post.body, publication_date: post.publicationDate, status: 'published' })), { onConflict: 'slug', ignoreDuplicates: true }).select('id'); if (postError) throw new Error('Unable to import sample media posts.'); const recordsCreated = (importedProducts?.length ?? 0) + (importedProjects?.length ?? 0) + (importedPosts?.length ?? 0); const recordsSkipped = records.products.length + records.projects.length + records.posts.length - recordsCreated; return { created, skipped, failed, recordsCreated, recordsSkipped }; }
