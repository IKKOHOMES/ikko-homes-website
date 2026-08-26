import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { App } from '../App';

const mockGetPublicCabinetryProductByRangeSlug = vi.hoisted(() => vi.fn(async () => ({
  id: 'cabinetry-japanese-modern', rangeId: 'range-japanese-modern', rangeSlug: 'japanese-modern', rangeName: 'Japanese Modern',
  name: 'Japanese Modern Cabinetry', eyebrow: 'Bespoke cabinetry', description: 'Calm cabinetry.', scope: 'Kitchen · Wardrobe', heroImageUrl: null, galleryImageUrls: [],
})));

vi.mock('../lib/public-cabinetry-products', () => ({ getPublicCabinetryProductByRangeSlug: mockGetPublicCabinetryProductByRangeSlug }));

test('cabinetry detail keeps the upload gate inside the reference detail layout', async () => {
  window.history.pushState({}, '', '/products/japanese-modern/cabinetry');
  render(<App />);

  expect(await screen.findByText('T.B.D.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Japanese Modern Cabinetry to cart' })).toBeDisabled();
  expect(screen.getByRole('tab', { name: 'Description' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /you may also like/i })).not.toBeInTheDocument();
});

test('cabinetry upload gate closes again after an invalid replacement file', async () => {
  window.history.pushState({}, '', '/products/japanese-modern/cabinetry');
  render(<App />);
  const upload = await screen.findByLabelText('Upload drawings');
  const addButton = screen.getByRole('button', { name: 'Add Japanese Modern Cabinetry to cart' });

  fireEvent.change(upload, { target: { files: [new File(['drawing'], 'kitchen-plan.pdf', { type: 'application/pdf' })] } });
  expect(addButton).toBeEnabled();

  fireEvent.change(upload, { target: { files: [new File(['wrong'], 'notes.txt', { type: 'text/plain' })] } });
  expect(addButton).toBeDisabled();
});

test('detail tabs associate the active tab with its panel', async () => {
  window.history.pushState({}, '', '/products/japanese-modern/cabinetry');
  render(<App />);
  const tab = await screen.findByRole('tab', { name: 'Description' });
  const panel = screen.getByRole('tabpanel');

  expect(tab).toHaveAttribute('aria-controls', panel.id);
  expect(panel).toHaveAttribute('aria-labelledby', tab.id);
});
