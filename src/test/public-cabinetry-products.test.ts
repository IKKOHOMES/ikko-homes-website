import { expect, test } from 'vitest';
import { mapPublicCabinetryProductRow } from '../lib/public-cabinetry-products';

test('maps a range-owned cabinetry product with only active images in display order', () => {
  const product = mapPublicCabinetryProductRow({
    id: 'cabinetry-japandi',
    eyebrow: 'Bespoke cabinetry',
    headline: 'Japandi Cabinetry',
    description: 'Warm, calm cabinetry.',
    detail_content: {
      description: { body: 'A calm joinery scheme.', bullets: ['Made to measure'] },
      details: { body: 'Timber veneer fronts.', bullets: [] },
      dimensions: { body: 'Confirmed from drawings.', bullets: [] },
      care: { body: 'Wipe gently.', bullets: ['Avoid abrasives'] },
    },
    scope: 'Kitchen · Wardrobe',
    hero_image_path: 'ranges/japandi/room.jpg',
    style_ranges: { id: 'range-japandi', slug: 'japandi', name: 'Japandi', is_active: true },
    cabinetry_product_images: [
      { id: 'hidden', image_path: 'ranges/japandi/hidden.jpg', display_order: 1, is_active: false },
      { id: 'second', image_path: 'ranges/japandi/second.jpg', display_order: 3, is_active: true },
      { id: 'first', image_path: 'ranges/japandi/first.jpg', display_order: 2, is_active: true },
    ],
  }, (path) => path ? `https://assets.example/${path}` : null);

  expect(product).toEqual({
    id: 'cabinetry-japandi',
    rangeId: 'range-japandi',
    rangeSlug: 'japandi',
    rangeName: 'Japandi',
    name: 'Japandi Cabinetry',
    eyebrow: 'Bespoke cabinetry',
    description: 'Warm, calm cabinetry.',
    detailContent: {
      description: { body: 'A calm joinery scheme.', bullets: ['Made to measure'] },
      details: { body: 'Timber veneer fronts.', bullets: [] },
      dimensions: { body: 'Confirmed from drawings.', bullets: [] },
      care: { body: 'Wipe gently.', bullets: ['Avoid abrasives'] },
    },
    scope: 'Kitchen · Wardrobe',
    heroImageUrl: 'https://assets.example/ranges/japandi/room.jpg',
    galleryImageUrls: [
      'https://assets.example/ranges/japandi/first.jpg',
      'https://assets.example/ranges/japandi/second.jpg',
    ],
  });
});
