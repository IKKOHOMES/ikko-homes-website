import { expect, test } from 'vitest';
import { loadExistingSampleRecords } from '../lib/sample-content';

test('prepares the existing catalogue and project samples for one-time cloud import', async () => {
  const records = await loadExistingSampleRecords();

  expect(records.products).toHaveLength(18);
  expect(records.projects).toHaveLength(4);
  expect(records.posts).toHaveLength(4);
  expect(records.products.some((product) => product.slug === 'mori-lounge-chair')).toBe(true);
  expect(records.products.filter((product) => ['nagi-side-table', 'hoku-dining-table', 'koto-dining-chair', 'sora-platform-bed', 'mizu-bedside-table'].includes(product.slug)).every((product) => product.themeSlugs.join(',') === 'japanese-modern,japandi,organic-modern')).toBe(true);
  expect(records.projects.some((project) => project.slug === 'bondi-residence')).toBe(true);
});
