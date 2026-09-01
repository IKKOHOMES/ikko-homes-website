import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { QuoteEditor } from '../components/admin/QuoteEditor';

const quoteWithTbdLine = {
  id: 'quote-1', orderId: 'order-1', version: 1, status: 'draft' as const, total: 0,
  quoteNumber: 'QTE-2026090001', createdAt: '2026-09-01T10:00:00.000Z', expiresOn: '2026-10-01', internalNote: '',
  lines: [{ id: 'line-1', displayName: 'Japandi Cabinetry', unitPrice: 0, quantity: 1, isTbd: true }],};

test('shows the quote number and issued date in the information panel', () => {
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={vi.fn()} onSave={vi.fn()} />);

  const information = screen.getByRole('complementary', { name: 'Quote information' });
  expect(information).toHaveTextContent('Quote no.');
  expect(information).toHaveTextContent('QTE-2026090001');
  expect(information).toHaveTextContent('Issue date');
  expect(information).toHaveTextContent('1 Sept 2026');
});

test('edits the expiry date from the quote information panel', () => {
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={vi.fn()} onSave={vi.fn()} />);

  const information = screen.getByRole('complementary', { name: 'Quote information' });
  const expiryDate = within(information).getByLabelText('Quote expiry date');
  fireEvent.change(expiryDate, { target: { value: '2026-10-15' } });

  expect(expiryDate).toHaveValue('2026-10-15');
  expect(screen.getAllByLabelText('Quote expiry date')).toHaveLength(1);
  expect(information).not.toHaveTextContent('Valid date');
});

test('blocks quote confirmation while a line remains T.B.D.', async () => {
  const onConfirm = vi.fn();
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={onConfirm} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm quote' }));
  expect(screen.getByText('Price every quote line before confirming.')).toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
});



test('displays the retained IKKO number on a revised quote', () => {
  render(<QuoteEditor quote={{ ...quoteWithTbdLine, version: 2, quoteNumber: 'IKKO2026080001' }} onConfirm={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByText('Quote IKKO2026080001 · v2')).toBeInTheDocument();
});

test('shows numbered quote columns with each line amount', () => {
  render(<QuoteEditor quote={{ ...quoteWithTbdLine, lines: [{ id: 'line-1', displayName: 'Japanese Modern Sofa 041', unitPrice: 3290, quantity: 2, isTbd: false }] }} onConfirm={vi.fn()} onSave={vi.fn()} />);

  const header = screen.getByText('No.').closest('.quote-editor__line-header');

  expect(header).toHaveTextContent('No.');
  expect(header).toHaveTextContent('Item & description');
  expect(header).toHaveTextContent('Quantity');
  expect(header).toHaveTextContent('Rate');
  expect(header).toHaveTextContent('Amount');
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByLabelText('Line 1 amount')).toHaveTextContent('$6,580.00');
});

test('shows each quote column label only in the table header', () => {
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getAllByText('Item & description')).toHaveLength(1);
  expect(screen.getAllByText('Quantity')).toHaveLength(1);
  expect(screen.getAllByText('Rate')).toHaveLength(1);
});

test('does not show an internal note field in the quote editor', () => {
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={vi.fn()} onSave={vi.fn()} />);

  expect(screen.queryByText('Internal note')).not.toBeInTheDocument();
});

test('replaces a T.B.D. rate with a numeric quote', async () => {
  const user = userEvent.setup();
  render(<QuoteEditor quote={quoteWithTbdLine} onConfirm={vi.fn()} onSave={vi.fn()} />);

  const rate = screen.getByLabelText('Line 1 rate');
  expect(rate).toHaveValue('T.B.D.');
  expect(screen.queryByLabelText('Line 1 T.B.D.')).not.toBeInTheDocument();

  await user.click(rate);
  await user.keyboard('1250');

  expect(rate).toHaveValue('1250');
  expect(screen.getByLabelText('Line 1 amount')).toHaveTextContent('$1,250.00');
});
