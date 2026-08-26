import { expect, test } from 'vitest';
import { getProductBySlug } from '../data/catalog';

test('returns the priced Mori Lounge Chair by slug', () => {
  expect(getProductBySlug('mori-lounge-chair')).toMatchObject({
    name: 'Mori Lounge Chair',
    price: 1290,
  });
});
