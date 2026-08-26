import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { CategoryManager } from '../components/admin/CategoryManager';
import type { ManagedProductCategory } from '../types/domain';

const categories: ManagedProductCategory[] = [
  { id: 'furniture-id', name: 'Furniture', slug: 'furniture', parentId: null, depth: 1, displayOrder: 1, isActive: true, productCount: 0 },
];

test('creates a nested category with its selected parent', async () => {
  const user = userEvent.setup(); const onSave = vi.fn(async () => undefined);
  render(<CategoryManager categories={categories} onDelete={() => undefined} onSave={onSave} onSetActive={async () => undefined} />);

  await user.click(screen.getByRole('button', { name: 'Add L2 Category' }));
  await user.type(screen.getByLabelText('Category name'), 'Living');
  await user.type(screen.getByLabelText('Category slug'), 'living');
  await user.selectOptions(screen.getByLabelText('Parent category'), 'furniture-id');
  await user.click(screen.getByRole('button', { name: 'Save category' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Living', slug: 'living', parentId: 'furniture-id', depth: 2 }));
});

test('offers a delete action for a category', async () => {
  const user = userEvent.setup(); const onDelete = vi.fn();
  render(<CategoryManager categories={categories} onDelete={onDelete} onSave={async () => undefined} onSetActive={async () => undefined} />);

  await user.click(screen.getByRole('button', { name: 'Delete Furniture' }));

  expect(onDelete).toHaveBeenCalledWith(categories[0]);
});

test('edits an existing category name and display order', async () => {
  const user = userEvent.setup(); const onSave = vi.fn(async () => undefined);
  render(<CategoryManager categories={categories} onDelete={() => undefined} onSave={onSave} onSetActive={async () => undefined} />);

  await user.click(screen.getByRole('button', { name: 'Edit Furniture' }));
  await user.clear(screen.getByLabelText('Category name'));
  await user.type(screen.getByLabelText('Category name'), 'Furniture & Storage');
  await user.clear(screen.getByLabelText('Category display order'));
  await user.type(screen.getByLabelText('Category display order'), '3');
  await user.click(screen.getByRole('button', { name: 'Save category' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'furniture-id', name: 'Furniture & Storage', slug: 'furniture-storage', displayOrder: 3 }));
});

test('blocks duplicate sibling names before saving', async () => {
  const user = userEvent.setup(); const onSave = vi.fn(async () => undefined);
  render(<CategoryManager categories={categories} onDelete={() => undefined} onSave={onSave} onSetActive={async () => undefined} />);

  await user.click(screen.getByRole('button', { name: 'Add L1 Category' }));
  await user.type(screen.getByLabelText('Category name'), 'furniture');
  await user.type(screen.getByLabelText('Category slug'), 'furniture-two');
  await user.click(screen.getByRole('button', { name: 'Save category' }));

  expect(screen.getByRole('alert')).toHaveTextContent('A category named “furniture” already exists at this level.');
  expect(onSave).not.toHaveBeenCalled();
});

test('renders categories as a parent-to-child tree rather than grouping every level together', () => {
  const nestedCategories: ManagedProductCategory[] = [
    { id: 'fixture', name: 'Fixture', slug: 'fixture', parentId: null, depth: 1, displayOrder: 2, isActive: true, productCount: 0 },
    { id: 'furniture', name: 'Furniture', slug: 'furniture', parentId: null, depth: 1, displayOrder: 1, isActive: true, productCount: 0 },
    { id: 'dining', name: 'Dining', slug: 'dining', parentId: 'furniture', depth: 2, displayOrder: 2, isActive: true, productCount: 0 },
    { id: 'living', name: 'Living', slug: 'living', parentId: 'furniture', depth: 2, displayOrder: 1, isActive: true, productCount: 0 },
    { id: 'sofa', name: 'Sofa', slug: 'sofa', parentId: 'living', depth: 3, displayOrder: 1, isActive: true, productCount: 0 },
    { id: 'lighting', name: 'Lighting', slug: 'lighting', parentId: 'fixture', depth: 2, displayOrder: 1, isActive: true, productCount: 0 },
    { id: 'pendant', name: 'Pendant', slug: 'pendant', parentId: 'lighting', depth: 3, displayOrder: 1, isActive: true, productCount: 0 },
  ];
  render(<CategoryManager categories={nestedCategories} onDelete={() => undefined} onSave={async () => undefined} onSetActive={async () => undefined} />);

  const names = [...screen.getByLabelText('Product category tree').querySelectorAll('article b')].map((element) => element.textContent);
  expect(names).toEqual(['Furniture', 'Living', 'Sofa', 'Dining', 'Fixture', 'Lighting', 'Pendant']);
});

test('groups the three category creation actions into one toolbar', () => {
  render(<CategoryManager categories={categories} onDelete={() => undefined} onSave={async () => undefined} onSetActive={async () => undefined} />);

  const actions = screen.getByRole('group', { name: 'Add category level' });
  expect([...actions.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
    'Add L1 Category',
    'Add L2 Category',
    'Add L3 Category',
  ]);
});
