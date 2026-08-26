import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ProductDetailContentFields } from '../components/admin/ProductDetailContentFields';
import { emptyProductDetailContent } from '../types/product-detail-content';

function DetailFieldsHarness() {
  const [value, setValue] = useState(emptyProductDetailContent);
  return <ProductDetailContentFields onChange={setValue} value={value} />;
}

test('shows a list editor only in the Description detail tab', async () => {
  const user = userEvent.setup();
  render(<DetailFieldsHarness />);

  expect(screen.getByRole('tab', { name: 'Description' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('Description list')).toBeInTheDocument();
  expect(screen.queryByLabelText('Details list')).not.toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Details' }));

  expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('Details body')).toBeInTheDocument();
  expect(screen.queryByLabelText('Description list')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Details list')).not.toBeInTheDocument();
});
