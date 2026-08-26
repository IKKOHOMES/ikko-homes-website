import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { Header } from '../components/layout/Header';
import { CartProvider } from '../context/CartContext';

test('opens a global search dialog from the header utility', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CartProvider><Header /></CartProvider></MemoryRouter>);

  await user.click(screen.getByRole('button', { name: 'Search' }));

  expect(screen.getByRole('dialog', { name: 'Search IKKO Homes' })).toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
});
