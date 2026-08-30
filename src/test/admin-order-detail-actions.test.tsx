import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getAdminOrder: vi.fn(), issueInvoice: vi.fn(), markInvoicePaid: vi.fn() }));
vi.mock('../lib/admin-api', () => ({ getAdminOrder: mocks.getAdminOrder, confirmQuote: vi.fn(), markInvoicePaid: mocks.markInvoicePaid, savePaymentPlan: vi.fn(), saveQuote: vi.fn() }));
vi.mock('../lib/admin-invoice', () => ({ synchroniseInvoiceDrafts: vi.fn(), issueInvoice: mocks.issueInvoice }));
vi.mock('../components/admin/DocumentActions', () => ({ DocumentActions: () => <span>Documents available</span> }));
vi.mock('../components/admin/QuoteEditor', () => ({ QuoteEditor: () => null }));
vi.mock('../components/admin/StatusBadge', () => ({ StatusBadge: () => null }));
vi.mock('../components/admin/PaymentPlanEditor', () => ({ PaymentPlanEditor: () => null }));

import { AdminOrderDetailPage } from '../pages/admin/AdminOrderDetailPage';

const detail = (status: 'draft' | 'issued' | 'paid') => ({
  order: { id: 'order-1', number: 'IKKO-001', customerName: 'Ada Lovelace', status: 'quoted', total: 1000 },
  customer: { email: 'ada@example.com', phone: '0400 000 000', address: '1 Example Street' }, internalNote: '', lines: [], drawings: [], quotes: [], paymentPlan: [],
  invoices: [{ id: 'invoice-1', number: 'INV-001', total: 500, status, dueOn: '2026-09-01', paidAt: null, paymentPlanInstalmentId: null }],
});
const renderPage = () => render(<MemoryRouter initialEntries={['/admin/orders/order-1']}><Routes><Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} /></Routes></MemoryRouter>);
afterEach(() => { mocks.getAdminOrder.mockReset(); mocks.issueInvoice.mockReset(); mocks.markInvoicePaid.mockReset(); });

test('keeps a draft issue action locked until the refreshed issued invoice loads', async () => {
  let resolveReload: ((value: ReturnType<typeof detail>) => void) | undefined;
  mocks.getAdminOrder.mockResolvedValueOnce(detail('draft')).mockImplementationOnce(() => new Promise((resolve) => { resolveReload = resolve; }));
  mocks.issueInvoice.mockResolvedValue(undefined);
  renderPage();
  const issue = await screen.findByRole('button', { name: 'Issue invoice' });
  await userEvent.click(issue);
  await waitFor(() => expect(mocks.issueInvoice).toHaveBeenCalledWith('order-1', 'invoice-1'));
  expect(issue).toBeDisabled();
  resolveReload?.(detail('issued'));
  expect(await screen.findByRole('button', { name: 'Mark paid' })).toBeInTheDocument();
  expect(screen.getByText('Documents available')).toBeInTheDocument();
});

test('marks an issued invoice paid and keeps the action locked until reload', async () => {
  let resolveReload: ((value: ReturnType<typeof detail>) => void) | undefined;
  mocks.getAdminOrder.mockResolvedValueOnce(detail('issued')).mockImplementationOnce(() => new Promise((resolve) => { resolveReload = resolve; }));
  mocks.markInvoicePaid.mockResolvedValue(undefined);
  renderPage();
  const paid = await screen.findByRole('button', { name: 'Mark paid' });
  await userEvent.click(paid);
  await waitFor(() => expect(mocks.markInvoicePaid).toHaveBeenCalledTimes(1));
  expect(paid).toBeDisabled();
  resolveReload?.(detail('paid'));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument());
});