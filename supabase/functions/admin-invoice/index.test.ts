import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { synchronisePaymentPlanInvoices } from './index.ts';

type StoredInvoice = { id: string; invoice_number: string; instalment_id: string; total: number; due_on: string; status: 'draft' | 'issued' | 'paid' };

function createRepository(overrides: Record<string, unknown> = {}) {
  const inserted: StoredInvoice[] = [];
  let sequence = 1000;
  const instalments = [
    { id: 'plan-1', label: 'Deposit', amount: 500, due_on: '2026-09-01', status: 'draft' as const },
    { id: 'plan-2', label: 'Balance', amount: 500, due_on: '2026-10-01', status: 'draft' as const },
  ];
  return {
    repository: {
      getConfirmedQuote: async () => ({ id: 'quote-1', total: 1000, has_tbd_lines: false }),
      getPaymentPlanInstalments: async () => instalments,
      getInvoices: async () => inserted,
      reserveInvoiceNumber: async () => `IKKO-${++sequence}`,
      createDraftInvoice: async (invoice: { total: number; payment_plan_instalment_id: string; invoice_number: string; due_on: string }) => {
        const created = { id: `invoice-${inserted.length + 1}`, invoice_number: invoice.invoice_number, instalment_id: invoice.payment_plan_instalment_id, total: invoice.total, due_on: invoice.due_on, status: 'draft' as const };
        inserted.push(created);
        return created;
      },
      updateDraftInvoice: async () => { throw new Error('not implemented'); },
      replaceInvoiceLine: async () => undefined,
      deleteDraftInvoice: async () => undefined,
      ...overrides,
    },
    inserted,
  };
}

Deno.test('creates one draft invoice for each payment schedule line', async () => {
  const { repository, inserted } = createRepository();

  const created = await synchronisePaymentPlanInvoices(repository, 'order-1');

  assertEquals(created.map((invoice) => invoice.status), ['draft', 'draft']);
  assertEquals(inserted.map((invoice) => invoice.total), [500, 500]);
  assertEquals(inserted.map((invoice) => invoice.due_on), ['2026-09-01', '2026-10-01']);
});

Deno.test('updates an existing draft without reserving a second invoice number', async () => {
  const { repository, inserted } = createRepository({
    getInvoices: async () => [{ id: 'invoice-1', invoice_number: 'IKKO-1000', instalment_id: 'plan-1', total: 450, due_on: '2026-08-01', status: 'draft' }],
    updateDraftInvoice: async (invoice: StoredInvoice) => ({ ...invoice, total: 500, due_on: '2026-09-01', status: 'draft' as const }),
  });

  const synchronised = await synchronisePaymentPlanInvoices(repository, 'order-1');

  assertEquals(synchronised.map((invoice) => invoice.invoice_number), ['IKKO-1000', 'IKKO-1001']);
  assertEquals(inserted.map((invoice) => invoice.invoice_number), ['IKKO-1001']);
});

Deno.test('does not replace an issued payment schedule invoice', async () => {
  const { repository } = createRepository({
    getInvoices: async () => [{ id: 'invoice-1', invoice_number: 'IKKO-1001', instalment_id: 'plan-1', total: 500, due_on: '2026-09-01', status: 'issued' }],
  });

  await assertRejects(() => synchronisePaymentPlanInvoices(repository, 'order-1'), Error, 'Issued instalments cannot be changed.');
});