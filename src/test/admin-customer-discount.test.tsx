import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

const registeredCustomer = {
  customer: {
    id: 'customer-1', name: 'Ari Lee', email: 'ari@example.com', phone: '0400 000 000', address: '1 Bondi Road', latestOrderAt: '2026-09-01T10:00:00.000Z', orderCount: 2,
    accountType: 'registered' as const, discountPercent: 12.5,
  },
  orders: [
    { id: 'order-1', number: 'ORD-2026090001', quoteNumber: 'QTE-2026090001', status: 'reviewing' as const, createdAt: '2026-09-01T10:00:00.000Z', total: 3290 },
    { id: 'order-2', number: 'ORDER-2', quoteNumber: null, status: 'quoted' as const, createdAt: '2026-08-01T10:00:00.000Z', total: null },
  ], notes: [],
};

vi.mock('../lib/admin-api', () => ({
  getCustomer: vi.fn(async () => registeredCustomer),
  addCustomerNote: vi.fn(async () => ({ id: 'note-1', body: 'Saved', createdAt: '2026-08-22T00:00:00.000Z' })),
  updateCustomerDiscount: vi.fn(async () => undefined),
  updateCustomerProfile: vi.fn(async () => undefined),
}));

import { AdminCustomerDetailPage } from '../pages/admin/AdminCustomerDetailPage';

test('saves a registered customer discount from the CRM detail page', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/admin/customers/customer-1']}><Routes>
    <Route path="/admin/customers/:id" element={<AdminCustomerDetailPage />} />
  </Routes></MemoryRouter>);

  const discount = await screen.findByLabelText('Customer discount (%)');
  expect(discount).toHaveValue(12.5);
  await user.clear(discount);
  await user.type(discount, '15');
  await user.click(screen.getByRole('button', { name: 'Save discount' }));

  expect(await screen.findByText('Discount saved.')).toBeInTheDocument();
});

test('shows an editable CRM summary and order history for a customer', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/admin/customers/customer-1']}><Routes>
    <Route path="/admin/customers/:id" element={<AdminCustomerDetailPage />} />
  </Routes></MemoryRouter>);

  expect(await screen.findByLabelText('First name')).toHaveValue('Ari');
  expect(screen.getByLabelText('Last name')).toHaveValue('Lee');
  expect(screen.getByLabelText('Email')).toHaveValue('ari@example.com');
  expect(screen.getAllByText('Orders')).toHaveLength(2);
  expect(screen.getByText('Order total value')).toBeInTheDocument();
  expect(screen.getAllByText('$3,290.00')).toHaveLength(2);
  expect(screen.getByRole('columnheader', { name: 'Order no.' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
  expect(screen.getByText('ORD-2026090001')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Customer discount' }).closest('.customer-crm-top-grid')).not.toBeNull();
  expect(screen.getByText('Pending review')).toBeInTheDocument();
  expect(screen.getByText('Quoted')).toBeInTheDocument();

  await user.clear(screen.getByLabelText('First name'));
  await user.type(screen.getByLabelText('First name'), 'Ariel');
  await user.click(screen.getByRole('button', { name: 'Save customer details' }));

  expect(await screen.findByText('Customer details saved.')).toBeInTheDocument();
});