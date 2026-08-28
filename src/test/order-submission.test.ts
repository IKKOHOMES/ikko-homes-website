import { expect, test, vi } from 'vitest';

const publicFunctionsInvoke = vi.fn();
const customerFunctionsInvoke = vi.fn(async () => ({
  data: { order_number: 'IKKO-1001', document_kind: 'invoice', discount_percent: 0, furniture_discount_total: 0 },
  error: null,
}));

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({ functions: { invoke: publicFunctionsInvoke } }),
  getCustomerSupabaseClient: () => ({ functions: { invoke: customerFunctionsInvoke } }),
}));

import { normaliseSubmissionResponse } from '../lib/order-submission';
import { submitOrder } from '../lib/order-submission';

test('returns the locked discount totals from checkout', () => {
  expect(normaliseSubmissionResponse({
    order_number: 'IKKO-1001', document_kind: 'quote-pending', discount_percent: 12.5, furniture_discount_total: 124.88,
  })).toEqual({
    orderNumber: 'IKKO-1001',
    documentKind: 'quote-pending',
    discountPercent: 12.5,
    furnitureDiscountTotal: 124.88,
  });
});

test('rejects an incomplete checkout response', () => {
  expect(() => normaliseSubmissionResponse({ order_number: 'IKKO-1001' })).toThrow('Unable to create the order.');
});

test('shows the order function validation message', async () => {
  customerFunctionsInvoke.mockResolvedValueOnce({
    data: null,
    error: { context: new Response(JSON.stringify({ error: 'Use the email address linked to your account.' }), { status: 400 }) },
  } as never);

  await expect(submitOrder([{
    id: 'line-error', kind: 'furniture', productId: 'product-1', productSlug: 'mori-chair', name: 'Mori Chair', price: 1290, quantity: 1, finish: 'Natural Oak', imageTone: 'oak',
  }], {
    firstName: 'Ari', lastName: 'Lee', email: 'ari@example.com', phone: '0400000000', address: '69 Patricia Loop', note: '',
  })).rejects.toThrow('Use the email address linked to your account.');
});

test('submits an order with the isolated customer session', async () => {
  await submitOrder([{
    id: 'line-1', kind: 'furniture', productId: 'product-1', productSlug: 'mori-chair', name: 'Mori Chair', price: 1290, quantity: 1, finish: 'Natural Oak', imageTone: 'oak',
  }], {
    firstName: 'Ari', lastName: 'Lee', email: 'ari@example.com', phone: '0400000000', address: '69 Patricia Loop', note: '',
  });

  expect(customerFunctionsInvoke).toHaveBeenCalledWith('create-order', expect.anything());
  expect(publicFunctionsInvoke).not.toHaveBeenCalled();
});

test('submits the durable product ID alongside the product slug', async () => {
  customerFunctionsInvoke.mockClear();
  await submitOrder([{
    id: 'line-product-id', kind: 'furniture', productId: '5c274229-5318-401b-b4e2-1a15c10a605e', productSlug: 'renamed-chair',
    name: 'Renamed Chair', price: 1290, quantity: 1, finish: 'Natural Oak', imageTone: 'oak',
  }], {
    firstName: 'Ari', lastName: 'Lee', email: 'ari@example.com', phone: '0400000000', address: '69 Patricia Loop', note: '',
  });

  const invocations = customerFunctionsInvoke.mock.calls as unknown as Array<[string, { body: FormData }]>;
  const invocation = invocations.at(-1)?.[1] as { body: FormData };
  const payload = JSON.parse(String(invocation.body.get('payload')));
  expect(payload.lines[0]).toMatchObject({ productId: '5c274229-5318-401b-b4e2-1a15c10a605e', slug: 'renamed-chair', name: 'Renamed Chair' });
});

test('submits the selected cabinetry product name and range identity', async () => {
  customerFunctionsInvoke.mockClear();
  const upload = new File(['drawing'], 'kitchen.pdf', { type: 'application/pdf' });
  await submitOrder([{
    id: 'cabinetry-line-1', kind: 'cabinetry', cabinetryProductId: 'cabinetry-japandi', rangeId: 'range-japandi',
    name: 'Japandi Cabinetry', price: null, quantity: 1, imageTone: 'cabinetry',
    upload: { id: 'drawing-1', name: 'kitchen.pdf', size: upload.size, type: upload.type, file: upload },
  }], {
    firstName: 'Ari', lastName: 'Lee', email: 'ari@example.com', phone: '0400000000', address: '69 Patricia Loop', note: '',
  });

  const invocations = customerFunctionsInvoke.mock.calls as unknown as Array<[string, { body: FormData }]>;
  const invocation = invocations.at(-1)?.[1] as { body: FormData };
  const payload = JSON.parse(String(invocation.body.get('payload')));
  expect(payload.lines).toEqual([{
    id: 'cabinetry-line-1', kind: 'cabinetry', cabinetryProductId: 'cabinetry-japandi', rangeId: 'range-japandi',
    name: 'Japandi Cabinetry', quantity: 1,
  }]);
});
