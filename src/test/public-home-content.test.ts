import { expect, test } from 'vitest';
import { mapPublicHomeContentRow } from '../lib/public-home-content';
import { mapPublicStyleRangeRow } from '../lib/public-style-ranges';

test('maps cloud homepage content and active service pillars without a local fallback', () => {
  const content = mapPublicHomeContentRow({
    hero_eyebrow: 'IKKO Homes', hero_heading: 'Timeless Design.', hero_cta_label: 'Visit us', hero_cta_path: '/contact', hero_image_path: 'home/hero.png',
  }, (path) => `https://assets.example/${path}`);

  expect(content).toEqual({ heroEyebrow: 'IKKO Homes', heroHeading: 'Timeless Design.', heroCtaLabel: 'Visit us', heroCtaPath: '/contact', heroImageUrl: 'https://assets.example/home/hero.png' });
});

test('maps a range image and managed palette modules from cloud fields only', () => {
  const range = mapPublicStyleRangeRow({
    id: 'range-1', slug: 'japandi', name: 'Japandi', eyebrow: 'Japandi', headline: 'Warmth.', description: 'Quiet interiors.', hero_image_path: null, room_image_path: 'ranges/japandi/room.png', palette: ['#ffffff'], display_order: 2, is_active: true,
    style_range_palette_items: [{ id: 'palette-1', name: 'Stone', colour: '#C7B7A3', image_path: 'ranges/japandi/palette/stone.jpg', display_order: 1, is_active: true }],
  }, (path) => `https://assets.example/${path}`);

  expect(range).toMatchObject({ slug: 'japandi', roomImageUrl: 'https://assets.example/ranges/japandi/room.png', heroImageUrl: null, isActive: true });
  expect(range.palette).toEqual([{ id: 'palette-1', name: 'Stone', colour: '#C7B7A3', imageUrl: 'https://assets.example/ranges/japandi/palette/stone.jpg', displayOrder: 1 }]);
});
