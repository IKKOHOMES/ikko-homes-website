import { getCustomerSupabaseClient } from './supabase';
import type { CartLine, CustomerDetails } from '../types/order';

export type OrderSubmission = {
  orderNumber: string;
  documentKind: 'quote-pending';
  discountPercent: number;
  furnitureDiscountTotal: number;
};

async function messageFromOrderError(error: unknown) {
  const fallback = 'We could not submit your order. Please try again or contact our studio.';
  if (!error || typeof error !== 'object' || !('context' in error)) return fallback;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return fallback;
  if (context.status === 401) return 'Please log in before submitting your order.';
  try {
    const payload = await context.clone().json() as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {
    // The endpoint did not return a readable JSON message.
  }
  return fallback;
}

export function normaliseSubmissionResponse(value: unknown): OrderSubmission {
  if (!value || typeof value !== 'object') throw new Error('Unable to create the order.');
  const response = value as {
    order_number?: unknown;
    document_kind?: unknown;
    discount_percent?: unknown;
    furniture_discount_total?: unknown;
  };
  if (typeof response.order_number !== 'string' || response.document_kind !== 'quote-pending') {
    throw new Error('Unable to create the order.');
  }
  if (typeof response.discount_percent !== 'number' || typeof response.furniture_discount_total !== 'number') {
    throw new Error('Unable to create the order.');
  }
  return {
    orderNumber: response.order_number,
    documentKind: response.document_kind,
    discountPercent: response.discount_percent,
    furnitureDiscountTotal: response.furniture_discount_total,
  };
}

export async function submitOrder(lines: CartLine[], customer: CustomerDetails): Promise<OrderSubmission> {
  const body = new FormData();
  const orderLines = lines.map((line) => {
    if (line.kind === 'cabinetry') {
      if (!line.upload.file) throw new Error('Please re-upload the cabinetry drawing before submitting.');
      body.append(`drawing:${line.id}`, line.upload.file, line.upload.name);
      return { id: line.id, kind: line.kind, cabinetryProductId: line.cabinetryProductId, rangeId: line.rangeId, name: line.name, quantity: line.quantity };
    }
    return { id: line.id, kind: line.kind, productId: line.productId, slug: line.productSlug, name: line.name, quantity: line.quantity, finish: line.finish };
  });
  body.append('payload', JSON.stringify({ customer, lines: orderLines }));
  const { data, error } = await getCustomerSupabaseClient().functions.invoke('create-order', { body });
  if (error) throw new Error(await messageFromOrderError(error));
  return normaliseSubmissionResponse(data);
}
