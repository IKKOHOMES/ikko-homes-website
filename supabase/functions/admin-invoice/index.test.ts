import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { issuePaymentPlanInvoices } from './index.ts';

Deno.test('issues one invoice for each draft instalment', async () => {
  const inserted: Array<{ total: number; payment_plan_instalment_id: string }> = [];
  let sequence = 1000;
  const repository = {
    getConfirmedQuote: async () => ({ id: 'quote-1', total: 1000, has_tbd_lines: false }),
    getDraftInstalments: async () => [
      { id: 'plan-1', label: 'Deposit', amount: 500, due_on: '2026-09-01' },
      { id: 'plan-2', label: 'Balance', amount: 500, due_on: '2026-10-01' },
    ],
    reserveInvoiceNumber: async () => `IKKO-${++sequence}`,
    insertInvoice: async (invoice: { total: number; payment_plan_instalment_id: string }) => { inserted.push(invoice); return { id: crypto.randomUUID() }; },
    insertInvoiceLine: async () => undefined,
    markInstalmentIssued: async () => undefined,
  };
  await issuePaymentPlanInvoices(repository, 'order-1');
  assertEquals(inserted.map((invoice) => invoice.total), [500, 500]);
});
