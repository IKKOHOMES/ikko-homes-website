import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { OrderTable } from '../components/admin/OrderTable';
import { QuoteForm } from '../components/admin/QuoteForm';
import type { AdminOrder } from '../types/domain';

const cabinetryOrder: AdminOrder = {
  id: 'order-1', number: 'ORD-1001', status: 'new', customerId: 'customer-1', customerName: 'Ari Lee',
  createdAt: '2026-08-21T10:00:00.000Z', total: null, hasCabinetry: true, invoiceStatus: null,
};

test('shows a T.B.D. cabinetry order as New and enables quote creation', () => {
  render(<MemoryRouter><OrderTable orders={[cabinetryOrder]} /></MemoryRouter>);

  expect(screen.getByText('T.B.D.')).toBeInTheDocument();
  expect(screen.getByText('New')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /prepare quote/i })).toHaveAttribute('href', '/admin/orders/order-1');
});

test('does not create a cabinetry quote with a zero amount', () => {
  render(<QuoteForm onSave={async () => undefined} orderId="order-1" />);
  fireEvent.change(screen.getByLabelText('Quote total'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save quotation' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Enter a quotation amount greater than zero.');
});
