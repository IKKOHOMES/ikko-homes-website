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

import { listCustomers, quoteDisplayNameForLines, saveManagedPaletteItem } from '../lib/admin-api';

test('loads CRM customers through the administrator session', async () => {
  await expect(listCustomers()).resolves.toEqual([]);

  expect(adminFrom).toHaveBeenCalledWith('customers');
  expect(publicFrom).not.toHaveBeenCalledWith('customers');
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
