import { expect, test, vi } from 'vitest';

const rpc = vi.fn(async () => ({ data: [], error: null }));
const query = {
  select: () => query,
  eq: () => query,
  neq: () => query,
  limit: async () => ({ data: [], error: null }),
  single: async () => ({ data: { id: 'quote-1', total: 1000, status: 'confirmed' }, error: null }),
  delete: () => query,
  insert: () => query,
  then: (resolve: (value: { error: null }) => unknown) => Promise.resolve(resolve({ error: null })),
};
vi.mock('../lib/supabase', () => ({ getAdminSupabaseClient: () => ({ from: () => query, rpc }) }));

import { savePaymentPlan } from '../lib/admin-api';

test('saves a schedule through the atomic draft-invoice RPC', async () => {
  const instalments = [
    { id: 'plan-1', label: 'Deposit', percentage: 50, amount: 500, dueOn: '2026-09-01', internalNote: '' },
    { id: 'plan-2', label: 'Balance', percentage: 50, amount: 500, dueOn: '2026-10-01', internalNote: '' },
  ];

  await savePaymentPlan('order-1', 'quote-1', instalments);

  expect(rpc).toHaveBeenCalledWith('replace_payment_plan_and_sync_invoices', {
    p_order_id: 'order-1', p_quote_id: 'quote-1', p_instalments: instalments,
  });
});