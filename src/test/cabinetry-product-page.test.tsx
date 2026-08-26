import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { App } from '../App';

const mockGetPublicCabinetryProductByRangeSlug = vi.hoisted(() => vi.fn());

vi.mock('../lib/public-cabinetry-products', () => ({
  getPublicCabinetryProductByRangeSlug: mockGetPublicCabinetryProductByRangeSlug,
}));

test('shows the range-owned cabinetry product and gates cart addition on a drawing', async () => {
  mockGetPublicCabinetryProductByRangeSlug.mockResolvedValue({
    id: 'cabinetry-japandi', rangeId: 'range-japandi', rangeSlug: 'japandi', rangeName: 'Japandi',
    name: 'Japandi Cabinetry', eyebrow: 'Bespoke cabinetry', description: 'Warm, calm cabinetry.',
    scope: 'Kitchen · Wardrobe', heroImageUrl: null, galleryImageUrls: [],
  });
  window.history.pushState({}, '', '/products/japandi/cabinetry');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Japandi Cabinetry' })).toBeInTheDocument();
  const addButton = screen.getByRole('button', { name: 'Add Japandi Cabinetry to cart' });
  expect(addButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Upload drawings'), {
    target: { files: [new File(['drawing'], 'kitchen-plan.pdf', { type: 'application/pdf' })] },
  });
  expect(addButton).toBeEnabled();
});

test('does not substitute a generic cabinetry page when the range product is unavailable', async () => {
  mockGetPublicCabinetryProductByRangeSlug.mockResolvedValue(null);
  window.history.pushState({}, '', '/products/organic-modern/cabinetry');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Cabinetry product unavailable.' })).toBeInTheDocument();
});
