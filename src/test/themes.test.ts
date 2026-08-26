import { expect, test } from 'vitest';
import { products } from '../data/catalog';
import { getThemeBySlug } from '../data/themes';

test('maps the Japandi theme to its approved route data', () => {
  const theme = getThemeBySlug('japandi');
  expect(theme?.name).toBe('Japandi');
  expect(theme?.productIds).toContain('mori-lounge-chair');
});

test('maps Japanese Modern to the Nami pendant catalog item', () => {
  expect(getThemeBySlug('japanese-modern')?.productIds).toContain('nami-light');
});

test('maps Organic Modern to the Nami pendant catalog item', () => {
  expect(getThemeBySlug('organic-modern')?.productIds).toContain('nami-light');
});

test('provides four distinct lighting products for themed product rails', () => {
  const lightingProducts = products.filter((product) => product.category === 'lighting');
  expect(lightingProducts).toHaveLength(4);
  expect(new Set(lightingProducts.map((product) => product.name)).size).toBe(4);
});
