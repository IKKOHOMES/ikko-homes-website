import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  synchroniseInvoiceDrafts: vi.fn(async () => ({ invoices: [] })),
  getAdminOrder: vi.fn(async () => ({
    order: { id: 'order-1', number: 'IKKO-ORDER-1', customerName: 'Aiko Tanaka', status: 'quoted', total: 1000 },
    customer: { email: 'aiko@example.com', phone: '0400000000', address: '1 Studio Lane' }, internalNote: '', lines: [], drawings: [], invoices: [], paymentPlan: [],
    quotes: [{ id: 'quote-1', orderId: 'order-1', version: 1, status: 'confirmed', total: 1000, expiresOn: '2026-09-01', internalNote: '', lines: [] }],
  })),
}));
vi.mock('../lib/admin-api', () => ({ getAdminOrder: mocks.getAdminOrder, confirmQuote: vi.fn(), markInvoicePaid: vi.fn(), savePaymentPlan: vi.fn(), saveQuote: vi.fn() }));
vi.mock('../lib/admin-invoice', () => ({ synchroniseInvoiceDrafts: mocks.synchroniseInvoiceDrafts, issueInvoice: vi.fn() }));
vi.mock('../components/admin/DocumentActions', () => ({ DocumentActions: () => null }));
vi.mock('../components/admin/QuoteEditor', () => ({ QuoteEditor: () => null }));
vi.mock('../components/admin/StatusBadge', () => ({ StatusBadge: () => null }));
vi.mock('../components/admin/PaymentPlanEditor', () => ({ PaymentPlanEditor: ({ onSync }: { onSync: () => Promise<void> }) => <button onClick={() => void onSync()} type="button">Sync invoice drafts</button> }));

import { AdminOrderDetailPage } from '../pages/admin/AdminOrderDetailPage';

test('syncing invoice drafts does not issue an unspecified invoice', async () => {
  render(<MemoryRouter initialEntries={['/admin/orders/order-1']}><Routes><Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} /></Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: 'Sync invoice drafts' }));
  await waitFor(() => expect(mocks.synchroniseInvoiceDrafts).toHaveBeenCalledWith('order-1'));
});