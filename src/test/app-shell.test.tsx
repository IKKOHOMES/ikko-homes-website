import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from '../App';

test('renders the IKKO Homes application shell', () => {
  render(<App />);

  expect(screen.getByRole('link', { name: /ikko homes/i })).toBeInTheDocument();
  expect(screen.getAllByRole('img', { name: 'IKKO Homes logo' })).toHaveLength(2);
});

test('renders the simplified footer navigation', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /stay inspired/i })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Services' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Company' })).toHaveAttribute('href', '/about');
  expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about#about-us');
  expect(screen.getByRole('link', { name: 'Our Process' })).toHaveAttribute('href', '/about#our-process');
  expect(screen.getByRole('link', { name: 'Terms & Conditions' })).toHaveAttribute('href', '/terms-and-conditions');
});

test('uses the approved social media set in the footer', () => {
  render(<App />);

  const social = screen.getByRole('navigation', { name: 'Social media' });
  expect(within(social).getByRole('link', { name: 'Instagram' })).toBeInTheDocument();
  expect(within(social).getByRole('link', { name: 'Facebook' })).toBeInTheDocument();
  expect(within(social).getByRole('link', { name: 'YouTube' })).toBeInTheDocument();
  expect(within(social).getByRole('link', { name: 'Rednote' })).toBeInTheDocument();
  expect(within(social).queryByRole('link', { name: 'Pinterest' })).not.toBeInTheDocument();
});

test('uses a line-art Xiaohongshu wordmark for Rednote', () => {
  render(<App />);

  const rednote = screen.getByRole('link', { name: 'Rednote' });
  expect(rednote.querySelector('svg text')?.textContent).toBe('小红书');
});

test('opens the terms and conditions page from its public route', () => {
  window.history.pushState({}, '', '/terms-and-conditions');
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Terms & Conditions' })).toBeInTheDocument();
});

test('shows the approved IKKO Homes contact details in the footer', () => {
  render(<App />);

  expect(screen.getByText('69 Patricia LoopKeysborough VIC 3173')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '0490 384 021' })).toHaveAttribute('href', 'tel:+61490384021');
  expect(screen.getByRole('link', { name: 'info@ikkohomes.com.au' })).toHaveAttribute('href', 'mailto:info@ikkohomes.com.au');
});
