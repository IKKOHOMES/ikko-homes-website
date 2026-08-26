import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { CustomerTable } from '../components/admin/CustomerTable';
import { CustomerNoteForm } from '../components/admin/CustomerNoteForm';
import { mapAdminCustomerRow } from '../lib/admin-api';

test('shows a customer email, order count and detail link', () => {
  render(<MemoryRouter><CustomerTable customers={[{
    id: 'customer-1', name: 'Ari Lee', email: 'ari@example.com', phone: '0400 000 000', address: '1 Bondi Road', latestOrderAt: '2026-08-21T10:00:00.000Z', orderCount: 2,
    accountType: 'registered', discountPercent: 12.5,
  }]} /></MemoryRouter>);

  expect(screen.getByText('ari@example.com')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('Registered')).toBeInTheDocument();
  expect(screen.getByText('12.5%')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/admin/customers/customer-1');
});

test('does not save an empty internal note', () => {
  render(<CustomerNoteForm onAdd={async () => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Write a note before saving.');
});

test('maps an auth-linked customer to their registered account discount', () => {
  const customer = mapAdminCustomerRow({
    id: 'customer-1', first_name: 'Ari', last_name: 'Lee', email: 'ari@example.com', phone: '0400 000 000', address: '1 Bondi Road',
    auth_user_id: 'auth-user-1', discount_percent: 12.5, orders: [],
  });

  expect(customer.accountType).toBe('registered');
  expect(customer.discountPercent).toBe(12.5);
});
