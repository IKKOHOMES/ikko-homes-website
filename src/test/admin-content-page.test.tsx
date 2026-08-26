import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { AdminContentPage } from '../pages/admin/AdminContentPage';

vi.mock('../lib/admin-api', () => ({
  getManagedHomeContent: vi.fn(async () => null),
  listManagedServicePillars: vi.fn(async () => []),
  listManagedStyleRanges: vi.fn(async () => [{ id: 'range-japandi', slug: 'japandi', name: 'Japandi', eyebrow: '', headline: '', description: '', heroImagePath: null, roomImagePath: null, palette: [], displayOrder: 1, isActive: true }]),
  listManagedHomeThemeBlocks: vi.fn(async () => [{ id: 'home-japandi', styleRangeId: 'range-japandi', rangeSlug: 'japandi', rangeName: 'Japandi', eyebrow: 'Homepage only', headline: 'Warmth in every detail.', description: 'Home copy that does not belong to the product page.', imagePath: null, displayOrder: 1, isActive: true }]),
  importExistingSampleContent: vi.fn(async () => ({ created: 0, skipped: 0, failed: 0, recordsCreated: 0, recordsSkipped: 0 })),
  publicAssetUrl: vi.fn(() => null),
}));

test('provides a protected admin workspace for homepage content and sample import', async () => {
  render(<AdminContentPage />);

  expect(await screen.findByRole('heading', { name: 'Homepage content' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Manage cabinetry' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import existing sample content' })).toBeInTheDocument();
});

test('groups each style range action into a distinct control bar', async () => {
  render(<AdminContentPage />);

  const actions = await screen.findByRole('group', { name: 'Japandi actions' });
  expect(within(actions).getAllByRole('button').map((button) => button.textContent)).toEqual(['Manage palette', 'Edit', 'Hide']);
});

test('updates a style range slug when its name changes', async () => {
  const user = userEvent.setup();
  render(<AdminContentPage />);

  await user.click(await screen.findByRole('button', { name: 'Add range' }));
  await user.type(screen.getByLabelText('Name'), 'Organic Modern');

  expect(screen.getByLabelText('URL slug')).toHaveValue('organic-modern');
  expect(screen.getByLabelText('URL slug')).toHaveAttribute('readonly');
});

test('manages homepage theme blocks separately from product range content', async () => {
  const user = userEvent.setup();
  render(<AdminContentPage />);

  expect(await screen.findByRole('heading', { name: 'Homepage theme blocks' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Homepage theme blocks' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Japandi homepage theme block actions' })).toBeInTheDocument();
  expect(screen.queryByText('Warmth in every detail.')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Add homepage theme block' }));

  expect(screen.getByRole('heading', { name: 'Add homepage theme block' })).toBeInTheDocument();
  expect(screen.getByLabelText('Range destination')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save homepage theme block' })).toBeInTheDocument();
});
