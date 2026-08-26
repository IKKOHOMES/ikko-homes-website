import type { CartLine, CustomerDetails, MockOrder } from '../types/order';

export function createMockOrder(lines: CartLine[], customer: CustomerDetails): MockOrder {
  return { id: `IKKO-${Date.now()}`, documentKind: lines.some((line) => line.kind === 'cabinetry') ? 'proforma' : 'invoice', lines, customer };
}
