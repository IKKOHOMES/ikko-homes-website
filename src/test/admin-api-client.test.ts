import { expect, test, vi } from 'vitest';

const adminFrom = vi.fn(() => ({
  select: () => ({ order: async () => ({ data: [], error: null }) }),
}));
const publicFrom = vi.fn(() => ({
  select: () => ({ order: async () => ({ data: [], error: null }) }),
}));

vi.mock('../lib/supabase', () => ({
  getAdminSupabaseClient: () => ({ from: adminFrom }),
  getSupabaseClient: () => ({ from: publicFrom }),
}));

import { getCustomer, listCustomers, quoteDisplayNameForLines, saveManagedPaletteItem } from '../lib/admin-api';

test('loads CRM customers through the administrator session', async () => {
  await expect(listCustomers()).resolves.toEqual([]);

  expect(adminFrom).toHaveBeenCalledWith('customers');
  expect(publicFrom).not.toHaveBeenCalledWith('customers');
});

test('uses the source quote number for a revised CRM history row', async () => {
  adminFrom.mockReturnValueOnce({
    select: () => ({ order: async () => ({ data: [], error: null }), eq: () => ({ single: async () => ({ data: {
      id: 'customer-1', first_name: 'Ari', last_name: 'Lee', email: 'ari@example.com', phone: '', address: '', auth_user_id: null, discount_percent: 0,
      orders: [{ id: 'order-1', order_number: 'ORD-2026090001', status: 'quoted', created_at: '2026-09-01T10:00:00.000Z', order_lines: [], quotes: [
        { id: 'quote-1', total: 100, version: 1, quote_number: 'QTE-2026090001', quote_number_source_id: null },
        { id: 'quote-2', total: 100, version: 2, quote_number: null, quote_number_source_id: 'quote-1' },
      ] }], customer_notes: [],
    }, error: null }) }) }),
  });

  await expect(getCustomer('customer-1')).resolves.toMatchObject({ orders: [{ quoteNumber: 'QTE-2026090001' }] });
});
test('rejects an invalid palette colour before saving', async () => {
  await expect(saveManagedPaletteItem({ styleRangeId: 'range-1', name: 'Stone', colour: 'warm beige', imagePath: null, displayOrder: 1, isActive: true })).rejects.toThrow('Enter a palette name and a hex colour.');
});

test('uses the submitted cabinetry product name for a quotation line', () => {
  expect(quoteDisplayNameForLines([
    { line_kind: 'furniture', display_name: 'Mori Lounge Chair' },
    { line_kind: 'cabinetry', display_name: 'Organic Modern Cabinetry' },
  ])).toBe('Organic Modern Cabinetry');
});
