import { expect, test } from 'vitest';
import { buildPublicTaxonomy, type TaxonomyCategory, type TaxonomyProduct } from '../lib/product-taxonomy';

const categories: TaxonomyCategory[] = [
  { id: 'furniture', name: 'Furniture', parentId: null, depth: 1, displayOrder: 1, isActive: true },
  { id: 'fixture', name: 'Fixture', parentId: null, depth: 1, displayOrder: 2, isActive: true },
  { id: 'living', name: 'Living', parentId: 'furniture', depth: 2, displayOrder: 1, isActive: true },
  { id: 'lighting', name: 'Lighting', parentId: 'fixture', depth: 2, displayOrder: 1, isActive: true },
  { id: 'sofa', name: 'Sofa', parentId: 'living', depth: 3, displayOrder: 1, isActive: true },
  { id: 'coffee-table', name: 'Coffee table', parentId: 'living', depth: 3, displayOrder: 2, isActive: true },
  { id: 'pendant', name: 'Pendant', parentId: 'lighting', depth: 3, displayOrder: 1, isActive: true },
];

const products: TaxonomyProduct[] = [
  { id: 'sofa-1', categoryId: 'sofa', displayOrder: 1, isActive: true },
  { id: 'coffee-1', categoryId: 'coffee-table', displayOrder: 1, isActive: true },
  { id: 'pendant-1', categoryId: 'pendant', displayOrder: 1, isActive: true },
];

test('builds ordered sections, tabs and product groups from a three-level category tree', () => {
  const tree = buildPublicTaxonomy(categories, products);

  expect(tree.map(({ name }) => name)).toEqual(['Furniture', 'Fixture']);
  expect(tree[0].tabs[0].name).toBe('Living');
  expect(tree[0].tabs[0].groups.map(({ name }) => name)).toEqual(['Sofa', 'Coffee table']);
  expect(tree[0].tabs[0].groups[0].products.map(({ id }) => id)).toEqual(['sofa-1']);
  expect(tree[1].tabs[0].groups[0].products.map(({ id }) => id)).toEqual(['pendant-1']);
});

test('omits inactive branches, unassigned products and empty category groups', () => {
  const tree = buildPublicTaxonomy(
    [...categories, { id: 'side-table', name: 'Side table', parentId: 'living', depth: 3, displayOrder: 3, isActive: false }],
    [...products, { id: 'unassigned', categoryId: null, displayOrder: 1, isActive: true }, { id: 'inactive', categoryId: 'sofa', displayOrder: 2, isActive: false }],
  );

  expect(tree[0].tabs[0].groups.map(({ name }) => name)).toEqual(['Sofa', 'Coffee table']);
  expect(tree.flatMap(({ tabs }) => tabs).flatMap(({ groups }) => groups).flatMap(({ products: groupedProducts }) => groupedProducts).map(({ id }) => id)).not.toContain('unassigned');
  expect(tree[0].tabs[0].groups[0].products.map(({ id }) => id)).toEqual(['sofa-1']);
});
