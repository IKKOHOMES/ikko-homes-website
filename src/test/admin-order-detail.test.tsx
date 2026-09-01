import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { AdminOrderDetailPage } from '../pages/admin/AdminOrderDetailPage';

const { getAdminOrder } = vi.hoisted(() => ({ getAdminOrder: vi.fn() }));

vi.mock('../lib/admin-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/admin-api')>()),
  getAdminOrder,
}));

vi.mock('../lib/admin-invoice', () => ({
  synchroniseInvoiceDrafts: vi.fn(),
  issueInvoice: vi.fn(),
}));

test('keeps document actions hidden while a payment invoice is a draft', async () => {
  getAdminOrder.mockResolvedValue({
    order: { id: 'order-1', number: 'IKKO-001', customerName: 'Ada Lovelace', status: 'quoted', total: 1000, createdAt: '2026-08-30T00:00:00Z', invoiceStatus: 'none' },
    customer: { email: 'ada@example.com', phone: '0400 000 000', address: '1 Example Street' },
    internalNote: '', lines: [{ id: 'line-1', name: 'Japanese Modern Sofa 041', kind: 'furniture', unitPrice: 1000, quantity: 1, finish: 'Natural oak' }], drawings: [{ fileName: 'plan.pdf', signedUrl: 'https://example.test/plan.pdf' }], paymentPlan: [], quotes: [],
    invoices: [{ id: 'invoice-1', number: 'INV-001', total: 500, status: 'draft', dueOn: '2026-09-01', paidAt: null, paymentPlanInstalmentId: null }],
  });

  render(<MemoryRouter initialEntries={['/admin/orders/order-1']}><Routes><Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} /></Routes></MemoryRouter>);

  expect(await screen.findByRole('button', { name: 'Issue invoice' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Email invoice' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Order notes' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Order no.' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Attached plans' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Order lines' }).closest('section')).toHaveClass('admin-order-detail__order-lines');
  expect(screen.getByText('Item')).toBeInTheDocument();
  expect(screen.getByText('Colour')).toBeInTheDocument();
  expect(screen.getByText('Size')).toBeInTheDocument();
  expect(screen.getByText('Quantity')).toBeInTheDocument();
  expect(screen.getByText('Cost')).toBeInTheDocument();
  expect(screen.getByText('Natural oak')).toBeInTheDocument();
});
