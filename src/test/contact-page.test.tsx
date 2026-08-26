import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from '../App';

test('shows the approved contact details on the contact page', () => {
  window.history.pushState({}, '', '/contact');
  render(<App />);
  const contact = document.querySelector('.contact-page') as HTMLElement;

  expect(screen.getByRole('heading', { name: /let.s create your home/i })).toBeInTheDocument();
  expect(within(contact).getByRole('list', { name: 'Contact methods' })).toHaveClass('contact-page__methods');
  expect(within(contact).getAllByRole('listitem')).toHaveLength(3);
  expect(within(contact).getByText('69 Patricia Loop, Keysborough VIC 3173')).toBeInTheDocument();
  expect(within(contact).getByRole('link', { name: '0490 384 021' })).toHaveAttribute('href', 'tel:+61490384021');
  expect(within(contact).getByRole('link', { name: 'info@ikkohomes.com.au' })).toHaveAttribute('href', 'mailto:info@ikkohomes.com.au');
});
