import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

const registeredCustomer = {
  customer: {
    id: 'customer-1', name: 'Ari Lee', email: 'ari@example.com', phone: '0400 000 000', address: '1 Bondi Road', latestOrderAt: null, orderCount: 0,
    accountType: 'registered' as const, discountPercent: 12.5,
  },
  orders: [], notes: [],
};

vi.mock('../lib/admin-api', () => ({
  getCustomer: vi.fn(async () => registeredCustomer),
  addCustomerNote: vi.fn(async () => ({ id: 'note-1', body: 'Saved', createdAt: '2026-08-22T00:00:00.000Z' })),
  updateCustomerDiscount: vi.fn(async () => undefined),
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
