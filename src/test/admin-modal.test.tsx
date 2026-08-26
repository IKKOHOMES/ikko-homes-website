import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { AdminModal } from '../components/admin/AdminModal';

test('keeps an editor in a modal dialog and closes it from the backdrop', () => {
  const onClose = vi.fn();
  render(<AdminModal label="Edit product" onClose={onClose}><form><label>Name<input defaultValue="Mori Lounge Chair" /></label></form></AdminModal>);

  const dialog = screen.getByRole('dialog', { name: 'Edit product' });
  expect(screen.getByDisplayValue('Mori Lounge Chair')).toBeVisible();
  fireEvent.mouseDown(dialog.parentElement!);
  expect(onClose).toHaveBeenCalledOnce();
});
