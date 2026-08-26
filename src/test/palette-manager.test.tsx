import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const api = vi.hoisted(() => ({
  deleteManagedPaletteItem: vi.fn(),
  listManagedPaletteItems: vi.fn(),
  publicAssetUrl: vi.fn((bucket: string, path: string | null) => path ? `https://assets.example/${bucket}/${path}` : null),
  saveManagedPaletteItem: vi.fn(),
  setPaletteItemActive: vi.fn(),
  uploadSiteImage: vi.fn(),
}));

vi.mock('../lib/admin-api', () => api);

import { PaletteManager } from '../components/admin/PaletteManager';

beforeEach(() => {
  api.listManagedPaletteItems.mockResolvedValue([]);
  api.saveManagedPaletteItem.mockResolvedValue({ id: 'palette-1' });
  api.uploadSiteImage.mockResolvedValue('ranges/range-1/palette/stone.jpg');
});

test('creates a named palette item with a fallback colour', async () => {
  const user = userEvent.setup();
  render(<PaletteManager onChanged={() => undefined} onClose={() => undefined} range={{ id: 'range-1', name: 'Japandi' }} />);

  await user.click(await screen.findByRole('button', { name: 'Add palette item' }));
  await user.type(screen.getByLabelText('Name'), 'Fabric');
  await user.clear(screen.getByLabelText('Fallback colour'));
  await user.type(screen.getByLabelText('Fallback colour'), '#BBAE9E');
  await user.click(screen.getByRole('button', { name: 'Save palette item' }));

  await waitFor(() => expect(api.saveManagedPaletteItem).toHaveBeenCalledWith(expect.objectContaining({ styleRangeId: 'range-1', name: 'Fabric', colour: '#BBAE9E' })));
});

test('uses a public storage URL for a saved material image preview', async () => {
  api.listManagedPaletteItems.mockResolvedValueOnce([{ id: 'palette-1', styleRangeId: 'range-1', name: 'Stone', colour: '#C7B7A3', imagePath: 'ranges/range-1/palette/stone.jpg', displayOrder: 1, isActive: true }]);
  render(<PaletteManager onChanged={() => undefined} onClose={() => undefined} range={{ id: 'range-1', name: 'Japandi' }} />);

  const preview = await screen.findByLabelText('Stone preview');
  expect(preview.style.backgroundImage).toContain('https://assets.example/site-assets/ranges/range-1/palette/stone.jpg');
});
