import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { App } from '../App';

test('opens the three approved theme links only after Products is clicked', async () => {
  render(<App />);
  const primaryNavigation = screen.getByRole('navigation', { name: 'Primary navigation' });
  const products = within(primaryNavigation).getByRole('button', { name: 'Products' });

  expect(products).toHaveAttribute('aria-expanded', 'false');
  expect(within(primaryNavigation).queryByRole('link', { name: 'Organic Modern' })).not.toBeInTheDocument();

  await userEvent.click(products);

  expect(products).toHaveAttribute('aria-expanded', 'true');
  const themeList = within(primaryNavigation).getByRole('list', { name: 'Product themes' });
  expect(within(themeList).getByRole('link', { name: 'Organic Modern' })).toHaveAttribute('href', '/products/organic-modern');
});
