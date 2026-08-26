import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { App } from '../App';

const mockListPublicCatalogue = vi.hoisted(() => vi.fn(async () => ({
  categories: [],
  products: [{
    id: 'mori-lounge-chair', slug: 'mori-lounge-chair', name: 'Mori Lounge Chair', description: 'A lounge chair.', price: 1290,
    category: 'living', categoryId: null, themeSlugs: ['japanese-modern'], displayOrder: 1, isActive: true,
    imageTone: 'chair', imageUrl: null, galleryImageUrls: [], finishes: ['Natural Oak', 'Walnut'],
  }],
})));

vi.mock('../lib/public-content', () => ({ listPublicCatalogue: mockListPublicCatalogue }));

test('labels the selectable product finish as colour', async () => {
  window.history.pushState({}, '', '/products/mori-lounge-chair');
  render(<App />);

  expect(await screen.findByText('Colour:', { selector: '.finish-choice b' })).toBeInTheDocument();
});
