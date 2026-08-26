import { expect, test } from 'vitest';
import { mapPublicHomeThemeBlockRow } from '../lib/public-home-theme-blocks';

test('maps a visible home block without reading range editorial content', () => {
  const block = mapPublicHomeThemeBlockRow({
    id: 'home-japanese',
    style_range_id: 'range-japanese',
    eyebrow: 'Japanese Modern',
    headline: 'Quietly considered living.',
    description: 'Independent Home editorial copy.',
    image_path: 'home/theme-blocks/japanese-modern.jpg',
    display_order: 1,
    is_active: true,
    style_ranges: { slug: 'japanese-modern', name: 'Japanese Modern' },
  }, (path) => path ? `https://assets.example/${path}` : null);

  expect(block).toEqual({
    id: 'home-japanese',
    rangeSlug: 'japanese-modern',
    rangeName: 'Japanese Modern',
    eyebrow: 'Japanese Modern',
    headline: 'Quietly considered living.',
    description: 'Independent Home editorial copy.',
    imageUrl: 'https://assets.example/home/theme-blocks/japanese-modern.jpg',
    displayOrder: 1,
  });
});
