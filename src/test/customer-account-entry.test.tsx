import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

test('shows customer login from the public account route', async () => {
  window.history.pushState({}, '', '/account');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
});

test('switches the public account form to administrator sign in without offering registration', async () => {
  const user = userEvent.setup();
  window.history.pushState({}, '', '/account');
  render(<App />);

  await user.click(await screen.findByRole('button', { name: 'Switch to administrator' }));

  expect(screen.getByRole('heading', { name: 'Administrator sign in' })).toBeInTheDocument();
  expect(screen.getByText('Log in for administration')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'LOG IN' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Switch to customer login' })).toBeInTheDocument();
});

test('sends an anonymous invoice visitor to customer login', async () => {
  window.history.pushState({}, '', '/account/invoices/invoice-1');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
});
