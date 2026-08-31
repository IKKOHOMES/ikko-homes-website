import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { PaymentPlanEditor } from '../components/admin/PaymentPlanEditor';
import type { PaymentPlanDraft } from '../lib/payment-plan';

test('only enables draft sync after saving a valid payment schedule', async () => {
  render(<PaymentPlanEditor quoteTotal={1000} instalments={[]} onSave={vi.fn()} onSync={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add instalment' }));
  expect(screen.getByRole('button', { name: 'Sync invoice drafts' })).toBeDisabled();
});

test('shows editable percentages and balances the final amount after a percentage edit', async () => {
  const user = userEvent.setup();
  render(<PaymentPlanEditor quoteTotal={1000} instalments={[
    { label: 'Deposit', percentage: 50, amount: 500, dueOn: '2026-09-01', internalNote: '' },
    { label: 'Final', percentage: 50, amount: 500, dueOn: '2026-10-01', internalNote: '' },
  ]} onSave={vi.fn()} onSync={vi.fn()} />);

  const percentage = screen.getByRole('spinbutton', { name: 'Instalment 1 percent' });
  expect(percentage).toHaveValue(50);
  expect(screen.getByRole('button', { name: 'Save payment schedule' })).toBeEnabled();
  await user.clear(percentage);
  await user.type(percentage, '33.33');

  expect(screen.getByRole('spinbutton', { name: 'Instalment 2 amount' })).toHaveValue(666.7);
});
test('requires a successful save in this session before syncing an initial valid schedule', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn(async (lines: PaymentPlanDraft[]) => lines);
  render(<PaymentPlanEditor quoteTotal={1000} instalments={[
    { label: 'Deposit', percentage: 50, amount: 500, dueOn: '2026-09-01', internalNote: '' },
    { label: 'Final', percentage: 50, amount: 500, dueOn: '2026-10-01', internalNote: '' },
  ]} onSave={onSave} onSync={vi.fn()} />);

  const sync = screen.getByRole('button', { name: 'Sync invoice drafts' });
  expect(sync).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Save payment schedule' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(sync).toBeEnabled();
  await user.type(screen.getByRole('textbox', { name: 'Instalment 1 description' }), ' updated');
  expect(sync).toBeDisabled();
});
test('keeps overdue rows immutable while leaving a draft row editable', async () => {
  render(<PaymentPlanEditor quoteTotal={1000} instalments={[
    { id: 'plan-1', label: 'Deposit', percentage: 50, amount: 500, dueOn: '2026-09-01', internalNote: '', status: 'overdue' },
    { id: 'plan-2', label: 'Balance', percentage: 50, amount: 500, dueOn: '2026-10-01', internalNote: '', status: 'draft' },
  ]} onSave={vi.fn()} onSync={vi.fn()} />);

  expect(screen.getByRole('textbox', { name: 'Instalment 1 description' })).toBeDisabled();
  expect(screen.getByRole('spinbutton', { name: 'Instalment 2 amount' })).toBeEnabled();
  expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Move instalment 2 up' })).toBeDisabled();
});
test('balances an edited draft against another draft without changing a final immutable milestone', async () => {
  const user = userEvent.setup();
  render(<PaymentPlanEditor quoteTotal={1000} instalments={[
    { id: 'plan-1', label: 'Deposit', percentage: 20, amount: 200, dueOn: '2026-09-01', internalNote: '', status: 'draft' },
    { id: 'plan-2', label: 'Balance', percentage: 30, amount: 300, dueOn: '2026-10-01', internalNote: '', status: 'draft' },
    { id: 'plan-3', label: 'Final immutable', percentage: 50, amount: 500, dueOn: '2026-11-01', internalNote: '', status: 'issued' },
  ]} onSave={vi.fn()} onSync={vi.fn()} />);

  const percentage = screen.getByRole('spinbutton', { name: 'Instalment 1 percent' });
  await user.clear(percentage);
  await user.type(percentage, '25');

  expect(screen.getByRole('spinbutton', { name: 'Instalment 2 amount' })).toHaveValue(250);
  expect(screen.getByRole('spinbutton', { name: 'Instalment 3 amount' })).toHaveValue(500);
});
test('keeps returned persisted IDs for the next save without waiting for a reload', async () => {
  const onSave = vi.fn()
    .mockResolvedValueOnce([{ id: 'persisted-deposit', label: 'Deposit', percentage: 100, amount: 1000, dueOn: '2026-09-01', internalNote: '' }])
    .mockResolvedValueOnce([{ id: 'persisted-deposit', label: 'Deposit revised', percentage: 100, amount: 1000, dueOn: '2026-09-01', internalNote: '' }]);
  const user = userEvent.setup();
  render(<PaymentPlanEditor quoteTotal={1000} instalments={[{ label: 'Deposit', percentage: 100, amount: 1000, dueOn: '2026-09-01', internalNote: '' }]} onSave={onSave} onSync={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: 'Save payment schedule' }));
  await user.click(screen.getByRole('button', { name: 'Save payment schedule' }));

  expect(onSave).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'persisted-deposit' })]);
});
test('applies a reloaded issued status without discarding an active draft edit', async () => {
  const initial = [{ id: 'plan-1', label: 'Deposit', percentage: 100, amount: 1000, dueOn: '2026-09-01', internalNote: '', status: 'draft' as const }];
  const view = render(<PaymentPlanEditor quoteTotal={1000} instalments={initial} onSave={vi.fn()} onSync={vi.fn()} />);
  const description = screen.getByRole('textbox', { name: 'Instalment 1 description' });
  await userEvent.type(description, ' updated');
  view.rerender(<PaymentPlanEditor quoteTotal={1000} instalments={[{ ...initial[0], status: 'issued' }]} onSave={vi.fn()} onSync={vi.fn()} />);
  expect(description).toHaveValue('Deposit updated');
  expect(description).toBeDisabled();
});
test('preserves a local no-ID addition and reorder while applying server updates to clean rows', async () => {
  const user = userEvent.setup();
  const initial = [
    { id: 'plan-1', label: 'Deposit', percentage: 50, amount: 500, dueOn: '2026-09-01', internalNote: '', status: 'draft' as const },
    { id: 'plan-2', label: 'Balance', percentage: 50, amount: 500, dueOn: '2026-10-01', internalNote: '', status: 'draft' as const },
  ];
  const view = render(<PaymentPlanEditor quoteTotal={1000} instalments={initial} onSave={vi.fn()} onSync={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Add instalment' }));
  await user.type(screen.getByRole('textbox', { name: 'Instalment 3 description' }), 'Local addition');
  await user.click(screen.getByRole('button', { name: 'Move instalment 3 up' }));
  await user.click(screen.getByRole('button', { name: 'Move instalment 2 up' }));

  view.rerender(<PaymentPlanEditor quoteTotal={1000} instalments={[
    { ...initial[1], label: 'Server balance updated' },
    { ...initial[0], label: 'Server deposit updated' },
  ]} onSave={vi.fn()} onSync={vi.fn()} />);

  expect(screen.getByRole('textbox', { name: 'Instalment 1 description' })).toHaveValue('Local addition');
  expect(screen.getByRole('textbox', { name: 'Instalment 2 description' })).toHaveValue('Server deposit updated');
  expect(screen.getByRole('textbox', { name: 'Instalment 3 description' })).toHaveValue('Server balance updated');
  expect(screen.getByText(/changed on the server/)).toBeInTheDocument();
});

test('surfaces a conflict when the server changes a locally edited row', async () => {
  const user = userEvent.setup();
  const initial = [{ id: 'plan-1', label: 'Deposit', percentage: 100, amount: 1000, dueOn: '2026-09-01', internalNote: '', status: 'draft' as const }];
  const view = render(<PaymentPlanEditor quoteTotal={1000} instalments={initial} onSave={vi.fn()} onSync={vi.fn()} />);
  await user.type(screen.getByRole('textbox', { name: 'Instalment 1 description' }), ' local');
  view.rerender(<PaymentPlanEditor quoteTotal={1000} instalments={[{ ...initial[0], label: 'Deposit server' }]} onSave={vi.fn()} onSync={vi.fn()} />);

  expect(screen.getByRole('textbox', { name: 'Instalment 1 description' })).toHaveValue('Deposit local');
  expect(screen.getByText(/changed on the server/)).toBeInTheDocument();
});