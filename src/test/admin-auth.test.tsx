import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { AdminShell } from '../components/admin/AdminShell';

test('redirects an unauthenticated visitor from the admin dashboard to the shared administrator sign in', async () => {
  window.history.pushState({}, '', '/admin/dashboard');
  render(<App />);

  expect(await screen.findByRole('heading', { name: /administrator sign in/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Switch to customer login' })).toBeInTheDocument();
});

test('redirects the legacy admin login address to the shared administrator sign in', async () => {
  window.history.pushState({}, '', '/admin/login');
  render(<App />);

  expect(await screen.findByRole('heading', { name: /administrator sign in/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Switch to customer login' })).toBeInTheDocument();
});

test('provides all internal management areas from the admin navigation', () => {
  const signOut = vi.fn();
  render(<MemoryRouter><AdminShell onSignOut={signOut}><h1>Dashboard</h1></AdminShell></MemoryRouter>);

  expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/admin/orders');
  expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('href', '/admin/customers');
  expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/admin/products');
  expect(screen.getByRole('link', { name: 'Categories' })).toHaveAttribute('href', '/admin/categories');
  expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/admin/projects');
  expect(screen.getByRole('link', { name: 'Blogs & Media' })).toHaveAttribute('href', '/admin/blogs');
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/admin/settings');
});
