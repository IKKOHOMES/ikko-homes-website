import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { QuoteBasedProductTable } from '../components/admin/QuoteBasedProductTable';
import type { ManagedCabinetryProduct } from '../types/domain';

const cabinetry: ManagedCabinetryProduct = {
  id: 'cabinetry-japandi',
  styleRangeId: 'range-japandi',
  rangeSlug: 'japandi',
  rangeName: 'Japandi',
  eyebrow: 'Bespoke cabinetry',
  headline: 'Japandi Cabinetry',
  description: 'Warm, made-to-measure joinery.',
  scope: 'Kitchen · Wardrobe',
  heroImagePath: null,
  isActive: true,
  images: [],
};

test('shows cabinetry as a quote-based product without a category or fixed price', async () => {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  render(<QuoteBasedProductTable products={[cabinetry]} onEdit={onEdit} />);

  expect(screen.getByText('Quote-Based Product')).toBeInTheDocument();
  expect(screen.getByText('T.B.D.')).toBeInTheDocument();
  expect(screen.getByText('Japandi')).toBeInTheDocument();
  expect(screen.queryByText('Category')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Edit Japandi Cabinetry' }));
  expect(onEdit).toHaveBeenCalledWith(cabinetry);
});
