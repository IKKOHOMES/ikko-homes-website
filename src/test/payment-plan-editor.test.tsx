import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { PaymentPlanEditor } from '../components/admin/PaymentPlanEditor';

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
  const onSave = vi.fn(async () => undefined);
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