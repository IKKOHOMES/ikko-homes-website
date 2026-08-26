import { expect, test } from 'vitest';
import { createMockOrder } from '../lib/order-document';
import type { CartLine, CustomerDetails } from '../types/order';

const customer: CustomerDetails = { firstName: 'Ava', lastName: 'Chen', email: 'ava@example.com', phone: '0400 000 000', address: '1 Bondi Road', note: '' };
const chair: CartLine = { id: 'chair-1', kind: 'furniture', productId: 'mori-lounge-chair', productSlug: 'mori-lounge-chair', name: 'Mori Lounge Chair', price: 1290, quantity: 1, finish: 'Natural Oak', imageTone: 'chair' };
const cabinetry: CartLine = { id: 'cabinet-1', kind: 'cabinetry', cabinetryProductId: 'cabinetry-japandi', rangeId: 'range-japandi', name: 'Japandi Cabinetry', price: null, quantity: 1, imageTone: 'cabinetry', upload: { id: 'drawing-1', name: 'kitchen.pdf', size: 200, type: 'application/pdf' } };

test('creates a proforma for an order containing cabinetry', () => {
  expect(createMockOrder([chair, cabinetry], customer).documentKind).toBe('proforma');
});

test('creates an invoice for a furniture-only order', () => {
  expect(createMockOrder([chair], customer).documentKind).toBe('invoice');
});
