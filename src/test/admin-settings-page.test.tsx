import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';
import { getSettings } from '../lib/admin-api';

vi.mock('../lib/admin-api', () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

test('shows a recoverable error instead of loading forever when settings cannot be read', async () => {
  vi.mocked(getSettings).mockRejectedValueOnce(new Error('Network unavailable'));

  render(<AdminSettingsPage />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load settings.');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  expect(screen.queryByText('Loading settings…')).not.toBeInTheDocument();
});
