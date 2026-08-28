import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { QuoteEditor } from '../components/admin/QuoteEditor';

const quoteWithTbdLine = {
  id: 'quote-1', orderId: 'order-1', version: 1, status: 'draft' as const, total: 0,
  expiresOn: '2026-10-01', internalNote: '',
  lines: [{ id: 'line-1', displayName: 'Japandi Cabinetry', unitPrice: 0, quantity: 1, isTbd: true }],
};

test('blocks quote confirmation while a line remains T.B.D.', async () => {
  const onConfirm = vi.fn();
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={onConfirm} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm quote' }));
  expect(screen.getByText('Price every quote line before confirming.')).toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
});
