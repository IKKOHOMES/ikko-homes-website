import { beforeEach, expect, test, vi } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();

function result<T>(value: T) {
  return {
    eq: vi.fn(() => result(value)),
    update: vi.fn(() => result(value)),
    delete: vi.fn(() => result(value)),
    insert: vi.fn(() => result(value)),
    select: vi.fn(() => result(value)),
    single: vi.fn(async () => value),
    then: (resolve: (value: T) => unknown) => Promise.resolve(value).then(resolve),
  };
}

vi.mock('../lib/supabase', () => ({
  getAdminSupabaseClient: () => ({ from, rpc }),
}));

import { saveQuote } from '../lib/admin-api';

const input = {
  quoteId: 'quote-1',
  orderId: 'order-1',
  expiresOn: '2026-09-30',
  internalNote: '',
  lines: [{ displayName: 'Cabinetry', unitPrice: 1000, quantity: 1, isTbd: false }],
};

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: new Error('number allocation should not be called') });
});

test('saves a draft quote without allocating a quote number', async () => {
  from.mockImplementation((table: string) => {
    if (table === 'quotes') return result({ data: { id: 'quote-1', version: 1, status: 'draft', quote_number: null, quote_number_source_id: null }, error: null });
    if (table === 'quote_lines') return result({ data: null, error: null });
    return result({ data: null, error: null });
  });

  await expect(saveQuote(input)).resolves.toBe('quote-1');
  expect(rpc).not.toHaveBeenCalled();
});

test('saves a confirmed quote revision without allocating a second quote number', async () => {
  let quoteReads = 0;
  const insert = vi.fn(() => result({ data: { id: 'quote-2' }, error: null }));
  from.mockImplementation((table: string) => {
    if (table === 'quotes') {
      quoteReads += 1;
      if (quoteReads === 1) return result({ data: { id: 'quote-1', version: 1, status: 'confirmed', quote_number: 'IKKO2026080001', quote_number_source_id: 'quote-1' }, error: null });
      const latest = result<any>({ data: [{ version: 1 }], error: null });
      latest.insert = insert;
      return latest;
    }
    if (table === 'quote_lines') return result({ data: null, error: null });
    return result({ data: null, error: null });
  });

  await expect(saveQuote(input)).resolves.toBe('quote-2');
  expect(rpc).not.toHaveBeenCalled();
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ quote_number_source_id: 'quote-1' }));
  expect((insert.mock.calls[0] as unknown as [Record<string, unknown>])[0]).not.toHaveProperty('quote_number');
});