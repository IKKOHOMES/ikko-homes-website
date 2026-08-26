import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../App';
import '../styles/global.css';

const mockListPublicHomeThemeBlocks = vi.hoisted(() => vi.fn());

vi.mock('../lib/public-home-theme-blocks', () => ({
  listPublicHomeThemeBlocks: mockListPublicHomeThemeBlocks,
}));

beforeEach(() => {
  mockListPublicHomeThemeBlocks.mockResolvedValue([]);
});

test('home does not retain static editorial themes when cloud content is empty', async () => {
  window.history.pushState({}, '', '/');
  render(<App />);

  await waitFor(() => expect(screen.queryByRole('link', { name: /explore japandi/i })).not.toBeInTheDocument());
});

test('home does not retain static editorial copy when cloud content is empty', async () => {
  window.history.pushState({}, '', '/');
  render(<App />);

  await waitFor(() => expect(document.querySelector<HTMLElement>('.theme-editorial__copy')).toBeNull());
});

test('renders Home editorial copy from Home Theme Blocks rather than Style Ranges', async () => {
  mockListPublicHomeThemeBlocks.mockResolvedValue([{
    id: 'home-japanese', rangeSlug: 'japanese-modern', rangeName: 'Japanese Modern',
    eyebrow: 'Home-only label', headline: 'Home-only headline', description: 'Home-only copy.', imageUrl: null, displayOrder: 1,
  }]);
  window.history.pushState({}, '', '/');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Home-only headline' })).toBeInTheDocument();
  expect(screen.getByText('Home-only label')).toBeInTheDocument();
  expect(screen.getByText('Home-only copy.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Explore Japanese Modern' })).toHaveAttribute('href', '/products/japanese-modern');
});
