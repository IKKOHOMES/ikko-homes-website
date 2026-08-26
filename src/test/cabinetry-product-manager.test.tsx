import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getManagedCabinetryProduct: vi.fn(),
  saveManagedCabinetryProduct: vi.fn(),
  replaceManagedCabinetryImages: vi.fn(),
  publicAssetUrl: vi.fn((bucket: string, path: string | null) => path ? `https://assets.example/${bucket}/${path}` : null),
  uploadSiteImage: vi.fn(),
}));

vi.mock('../lib/admin-api', () => api);

import { CabinetryProductManager } from '../components/admin/CabinetryProductManager';

beforeEach(() => {
  api.getManagedCabinetryProduct.mockResolvedValue({
    id: 'cabinetry-japanese-modern', styleRangeId: 'range-japanese-modern', rangeSlug: 'japanese-modern', rangeName: 'Japanese Modern',
    eyebrow: 'Bespoke cabinetry', headline: 'Japanese Modern Cabinetry', description: 'Clean joinery.', scope: 'Kitchen · Wardrobe',
    heroImagePath: 'ranges/japanese-modern/cabinetry/hero.jpg', isActive: true, images: [],
  });
  api.saveManagedCabinetryProduct.mockResolvedValue({ id: 'cabinetry-japanese-modern' });
  api.replaceManagedCabinetryImages.mockResolvedValue(undefined);
});

test('saves cabinetry content only for the selected style range', async () => {
  const user = userEvent.setup();
  render(<CabinetryProductManager onChanged={() => undefined} onClose={() => undefined} range={{ id: 'range-japanese-modern', slug: 'japanese-modern', name: 'Japanese Modern' }} />);

  expect(await screen.findByRole('heading', { name: 'Manage Japanese Modern Cabinetry' })).toBeInTheDocument();
  expect(screen.getByText('/products/japanese-modern/cabinetry')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Heading'));
  await user.type(screen.getByLabelText('Heading'), 'Japanese Modern Cabinetry Collection');
  await user.click(screen.getByRole('button', { name: 'Save cabinetry' }));

  await waitFor(() => expect(api.saveManagedCabinetryProduct).toHaveBeenCalledWith(expect.objectContaining({
    id: 'cabinetry-japanese-modern', styleRangeId: 'range-japanese-modern', headline: 'Japanese Modern Cabinetry Collection',
  })));
});

test('saves editable Care & Maintenance content for a quote-based product', async () => {
  const user = userEvent.setup();
  render(<CabinetryProductManager onChanged={() => undefined} onClose={() => undefined} range={{ id: 'range-japanese-modern', slug: 'japanese-modern', name: 'Japanese Modern' }} />);

  await screen.findByRole('heading', { name: 'Manage Japanese Modern Cabinetry' });
  await user.click(screen.getByRole('tab', { name: 'Care & Maintenance' }));
  await user.type(screen.getByLabelText('Care & Maintenance body'), 'Wipe joinery with a soft cloth.');
  await user.click(screen.getByRole('button', { name: 'Save cabinetry' }));

  await waitFor(() => expect(api.saveManagedCabinetryProduct).toHaveBeenCalledWith(expect.objectContaining({
    detailContent: expect.objectContaining({ care: expect.objectContaining({ body: 'Wipe joinery with a soft cloth.' }) }),
  })));
});
