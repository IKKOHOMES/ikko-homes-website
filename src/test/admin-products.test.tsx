import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ProductForm } from '../components/admin/ProductForm';
import { ProductTable } from '../components/admin/ProductTable';
import { mapManagedProductRow } from '../lib/admin-api';
import type { ManagedProduct, ManagedProductCategory, ManagedStyleRange } from '../types/domain';

const archivedProduct: ManagedProduct = {
  id: 'product-1',
  name: 'Mori Lounge Chair',
  slug: 'mori-lounge-chair',
  description: 'A sculptural oak lounge chair.',
  price: 1290,
  category: 'Furniture',
  subcategory: 'Living / Armchair',
  categoryId: 'sofa-id',
  categoryPath: ['Furniture', 'Living', 'Sofa'],
  themeSlugs: ['japanese-modern'],
  finishes: ['Natural Oak', 'Walnut'],
  imagePath: null,
  isActive: false,
  displayOrder: 1,
};

const categories: ManagedProductCategory[] = [
  { id: 'furniture-id', name: 'Furniture', slug: 'furniture', parentId: null, depth: 1, displayOrder: 1, isActive: true, productCount: 0 },
  { id: 'living-id', name: 'Living', slug: 'living', parentId: 'furniture-id', depth: 2, displayOrder: 1, isActive: true, productCount: 0 },
  { id: 'sofa-id', name: 'Sofa', slug: 'sofa', parentId: 'living-id', depth: 3, displayOrder: 1, isActive: true, productCount: 1 },
];
const ranges: ManagedStyleRange[] = [
  { id: 'range-japandi', slug: 'japandi', name: 'Japandi', eyebrow: 'Japandi', headline: 'Warmth.', description: 'Quiet interiors.', heroImagePath: null, roomImagePath: null, palette: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], displayOrder: 1, isActive: true },
  { id: 'range-new', slug: 'new-range', name: 'New Range', eyebrow: '', headline: '', description: '', heroImagePath: null, roomImagePath: null, palette: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], displayOrder: 2, isActive: true },
];

test('marks an archived product unavailable rather than deleting its history', () => {
  render(<ProductForm initialValue={archivedProduct} onSave={async () => undefined} />);

  expect(screen.getByLabelText('Visible on public website')).not.toBeChecked();
});

test('offers a delete action for an archived product', async () => {
  const user = userEvent.setup(); const onDelete = vi.fn();
  render(<ProductTable onArchive={() => undefined} onDelete={onDelete} onEdit={() => undefined} products={[archivedProduct]} />);

  await user.click(screen.getByRole('button', { name: 'Delete Mori Lounge Chair' }));

  expect(onDelete).toHaveBeenCalledWith(archivedProduct);
});

test('sorts products by public range, category hierarchy and L3 display order', () => {
  const orderedRanges: ManagedStyleRange[] = [
    { ...ranges[0], id: 'range-japanese-modern', slug: 'japanese-modern', name: 'Japanese Modern', displayOrder: 1 },
    { ...ranges[0], displayOrder: 2 },
  ];
  const orderedCategories: ManagedProductCategory[] = [
    { ...categories[0], displayOrder: 1 },
    { ...categories[1], id: 'bedroom-id', name: 'Bedroom', slug: 'bedroom', parentId: 'furniture-id', displayOrder: 1 },
    { ...categories[1], displayOrder: 2 },
    { ...categories[2], id: 'bed-id', name: 'Bed', slug: 'bed', parentId: 'bedroom-id', displayOrder: 1 },
    { ...categories[2], displayOrder: 1 },
  ];
  const products = [
    { ...archivedProduct, id: 'japandi', name: 'Japandi product', categoryId: 'bed-id', themeSlugs: ['japandi'], displayOrder: 1 },
    { ...archivedProduct, id: 'sofa-second', name: 'Sofa second', categoryId: 'sofa-id', themeSlugs: ['japanese-modern'], displayOrder: 2 },
    { ...archivedProduct, id: 'sofa-first', name: 'Sofa first', categoryId: 'sofa-id', themeSlugs: ['japanese-modern'], displayOrder: 1 },
    { ...archivedProduct, id: 'bedroom', name: 'Bedroom product', categoryId: 'bed-id', themeSlugs: ['japanese-modern'], displayOrder: 8 },
  ];

  render(<ProductTable categories={orderedCategories} onArchive={() => undefined} onDelete={() => undefined} onEdit={() => undefined} products={products} styleRanges={orderedRanges} />);

  expect(screen.getAllByRole('row').slice(1).map((row) => (row as HTMLTableRowElement).cells[0].textContent)).toEqual([
    'Bedroom product', 'Sofa first', 'Sofa second', 'Japandi product',
  ]);
});

test('saves an existing product order adjusted with the native number input', async () => {
  const user = userEvent.setup(); const onSave = vi.fn(async () => undefined);
  render(<ProductForm initialValue={{ ...archivedProduct, isActive: true, displayOrder: 2 }} onSave={onSave} />);

  const displayOrder = screen.getByLabelText('Product display order');
  expect(displayOrder).toHaveAttribute('type', 'number');
  expect(displayOrder).not.toHaveAttribute('readonly');

  await user.clear(displayOrder);
  await user.type(displayOrder, '1');
  await user.click(screen.getByRole('button', { name: 'Save product' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayOrder: 1 }));
});

test('does not show an ordering instruction below the display order control', () => {
  render(<ProductForm initialValue={{ ...archivedProduct, isActive: true, displayOrder: 2 }} onSave={async () => undefined} />);

  expect(screen.queryByText('Use the arrows to place this product within its L3 category.')).not.toBeInTheDocument();
});

test('creates a reusable colour from the product colour dropdown', async () => {
  const user = userEvent.setup(); const onSave = vi.fn(async () => undefined);
  const createdColour = { id: 'colour-dark-oak', name: 'Dark Oak', hexCode: '#5B3A29' };
  const onCreateColour = vi.fn(async () => createdColour);
  render(<ProductForm colours={[]} initialValue={{ ...archivedProduct, isActive: true, finishes: [] }} onCreateColour={onCreateColour} onSave={onSave} />);

  await user.selectOptions(screen.getByLabelText('Product colours'), '__create_colour__');
  await user.type(screen.getByLabelText('Colour name'), 'Dark Oak');
  await user.type(screen.getByLabelText('HEX colour code'), '#5B3A29');
  await user.click(screen.getByRole('button', { name: 'Create colour' }));
  await user.click(screen.getByRole('button', { name: 'Save product' }));

  expect(onCreateColour).toHaveBeenCalledWith({ name: 'Dark Oak', hexCode: '#5B3A29' });
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ finishes: ['Dark Oak'] }));
});

test('rejects a product without a theme before it can be saved', () => {
  const onSave = vi.fn(async () => undefined);
  render(<ProductForm initialValue={{ ...archivedProduct, isActive: true, themeSlugs: [] }} onSave={onSave} />);

  fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one product range.');
  expect(onSave).not.toHaveBeenCalled();
});

test('uses currently managed product ranges instead of a fixed range list', () => {
  render(<ProductForm styleRanges={ranges} initialValue={archivedProduct} onSave={async () => undefined} />);

  expect(screen.getByLabelText('New Range')).toBeInTheDocument();
  expect(screen.queryByLabelText('Japanese Modern')).not.toBeInTheDocument();
});

test('updates a product slug when its name changes', async () => {
  const user = userEvent.setup();
  render(<ProductForm initialValue={archivedProduct} onSave={async () => undefined} />);

  await user.clear(screen.getByLabelText('Product name'));
  await user.type(screen.getByLabelText('Product name'), 'Coastal Lounge Chair');

  expect(screen.getByLabelText('Product slug')).toHaveValue('coastal-lounge-chair');
  expect(screen.getByLabelText('Product slug')).toHaveAttribute('readonly');
});

test('maps a selected leaf category to its full managed category path', () => {
  const product = mapManagedProductRow({
    id: 'product-1', name: 'Haru Sofa', slug: 'haru-sofa', description: 'A sofa.', price: 1899,
    category: 'seating', subcategory: 'living', category_id: 'sofa-id', theme_slugs: ['japandi'], image_path: null,
    is_active: true, display_order: 1, product_finishes: [],
  }, [
    { id: 'furniture-id', name: 'Furniture', slug: 'furniture', parentId: null, depth: 1, displayOrder: 1, isActive: true, productCount: 0 },
    { id: 'living-id', name: 'Living', slug: 'living', parentId: 'furniture-id', depth: 2, displayOrder: 1, isActive: true, productCount: 0 },
    { id: 'sofa-id', name: 'Sofa', slug: 'sofa', parentId: 'living-id', depth: 3, displayOrder: 1, isActive: true, productCount: 1 },
  ]);

  expect(product.categoryId).toBe('sofa-id');
  expect(product.categoryPath).toEqual(['Furniture', 'Living', 'Sofa']);
});

test('selects a product category through the L1, L2 and L3 dropdowns', async () => {
  const user = userEvent.setup(); const onSave = vi.fn(async () => undefined);
  render(<ProductForm categories={categories} initialValue={{ ...archivedProduct, isActive: true, categoryId: null, categoryPath: [] }} onSave={onSave} />);

  await user.selectOptions(screen.getByLabelText('L1 Category'), 'furniture-id');
  await user.selectOptions(screen.getByLabelText('L2 Category'), 'living-id');
  await user.selectOptions(screen.getByLabelText('L3 Category'), 'sofa-id');
  await user.click(screen.getByRole('button', { name: 'Save product' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'sofa-id', category: 'Furniture', subcategory: 'Living / Sofa', categoryPath: ['Furniture', 'Living', 'Sofa'] }));
});

test('saves editable Care & Maintenance content for a priced product', async () => {
  const user = userEvent.setup(); const onSave = vi.fn(async () => undefined);
  render(<ProductForm initialValue={{ ...archivedProduct, isActive: true }} onSave={onSave} />);

  await user.click(screen.getByRole('tab', { name: 'Care & Maintenance' }));
  await user.type(screen.getByLabelText('Care & Maintenance body'), 'Vacuum upholstery weekly.');
  await user.click(screen.getByRole('button', { name: 'Save product' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    detailContent: expect.objectContaining({ care: expect.objectContaining({ body: 'Vacuum upholstery weekly.' }) }),
  }));
});
