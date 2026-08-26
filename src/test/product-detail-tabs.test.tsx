import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { DetailTabs } from '../components/product/DetailTabs';

test('shows the editable Care & Maintenance content for a product', async () => {
  const user = userEvent.setup();
  render(
    <DetailTabs
      productName="Mori Sofa"
      isCabinetry={false}
      detailContent={{
        description: { body: 'Designed for a calm home.', bullets: ['Solid oak frame'] },
        details: { body: 'Made with care.', bullets: ['Hand-finished'] },
        dimensions: { body: 'W 2100 × D 900 mm.', bullets: ['Measure access paths'] },
        care: { body: 'Vacuum upholstery weekly.', bullets: ['Keep away from direct sunlight'] },
      }}
    />,
  );

  await user.click(screen.getByRole('tab', { name: 'Care & Maintenance' }));

  expect(screen.getByText('Vacuum upholstery weekly.')).toBeInTheDocument();
  expect(screen.getByText('Keep away from direct sunlight')).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Delivery & Returns' })).not.toBeInTheDocument();
});
