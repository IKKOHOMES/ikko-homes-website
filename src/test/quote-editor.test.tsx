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


test('renders quote document actions beside Save quote', () => {
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={vi.fn()} onSave={vi.fn()} documentActions={<><button type="button">Download PDF</button><button type="button">Email Quote</button></>} />);

  const actionRow = screen.getByRole('button', { name: 'Save quote' }).parentElement;
  expect(actionRow).toContainElement(screen.getByRole('button', { name: 'Download PDF' }));
  expect(actionRow).toContainElement(screen.getByRole('button', { name: 'Email Quote' }));
});

test('displays the retained IKKO number on a revised quote', () => {
  render(<QuoteEditor quote={{ ...quoteWithTbdLine, version: 2, quoteNumber: 'IKKO2026080001' }} onConfirm={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByText('Quote IKKO2026080001 · v2')).toBeInTheDocument();
});
