import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';

describe('home header treatment', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('layers the header over the home hero', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'IKKO Homes' }).closest('header')).toHaveClass('site-header--overlay');
  });

  it('layers the header over a theme products hero', () => {
    window.history.pushState({}, '', '/products/japandi');
    render(<App />);

    expect(screen.getByRole('link', { name: 'IKKO Homes' }).closest('header')).toHaveClass('site-header--overlay');
  });

  it('uses the white, dark-text header treatment away from home and product hero pages', () => {
    window.history.pushState({}, '', '/contact');
    render(<App />);

    expect(screen.getByRole('link', { name: 'IKKO Homes' }).closest('header')).toHaveClass('site-header--surface');
    expect(screen.getByRole('contentinfo')).toHaveClass('site-footer--surface');
  });
});
