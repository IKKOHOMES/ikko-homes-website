import { FormEvent, useMemo, useState } from 'react';
import { AdminModal } from './AdminModal';
import type { ProductCategorySaveInput } from '../../lib/admin-api';
import { slugify } from '../../lib/slug';
import type { ManagedProductCategory } from '../../types/domain';

type CategoryManagerProps = {
  categories: ManagedProductCategory[];
  onSave: (input: ProductCategorySaveInput) => Promise<void>;
  onSetActive: (category: ManagedProductCategory, isActive: boolean) => Promise<void>;
  onDelete: (category: ManagedProductCategory) => void;
};

type Draft = ProductCategorySaveInput;

function emptyDraft(depth: 1 | 2 | 3, parentId: string | null): Draft {
  return { name: '', slug: '', parentId, depth, displayOrder: 0, isActive: true };
}

function compareCategories(left: ManagedProductCategory, right: ManagedProductCategory) {
  return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name);
}

function orderCategoryTree(categories: ManagedProductCategory[]) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const childrenByParent = new Map<string | null, ManagedProductCategory[]>();
  for (const category of categories) {
    const parentId = category.parentId && categoryById.has(category.parentId) ? category.parentId : null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), category]);
  }
  for (const children of childrenByParent.values()) children.sort(compareCategories);

  const ordered: ManagedProductCategory[] = [];
  const visited = new Set<string>();
  function visit(category: ManagedProductCategory) {
    if (visited.has(category.id)) return;
    visited.add(category.id);
    ordered.push(category);
    for (const child of childrenByParent.get(category.id) ?? []) visit(child);
  }
  for (const root of childrenByParent.get(null) ?? []) visit(root);
  for (const category of [...categories].sort(compareCategories)) visit(category);
  return ordered;
}

export function CategoryManager({ categories, onDelete, onSave, onSetActive }: CategoryManagerProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const ordered = useMemo(() => orderCategoryTree(categories), [categories]);
  const parentChoices = ordered.filter((category) => category.depth === (draft?.depth ?? 1) - 1);

  function start(depth: 1 | 2 | 3) { setError(''); setDraft(emptyDraft(depth, depth === 1 ? null : ordered.find((category) => category.depth === depth - 1)?.id ?? null)); }
  function edit(category: ManagedProductCategory) { setError(''); setDraft({ id: category.id, name: category.name, slug: category.slug, parentId: category.parentId, depth: category.depth, displayOrder: category.displayOrder, isActive: category.isActive }); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return;
    const normalizedName = draft.name.trim().toLowerCase();
    const hasDuplicateSibling = categories.some((category) => category.id !== draft.id && category.parentId === draft.parentId && category.name.trim().toLowerCase() === normalizedName);
    if (hasDuplicateSibling) { setError(`A category named “${draft.name.trim()}” already exists at this level.`); return; }
    setSaving(true); setError('');
    try { await onSave({ ...draft, name: draft.name.trim(), slug: draft.slug.trim().toLowerCase() }); setDraft(null); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save category.'); }
    finally { setSaving(false); }
  }

  return <section className="category-manager"><div className="admin-toolbar"><div aria-label="Add category level" className="admin-toolbar__actions" role="group"><button className="button" onClick={() => start(1)} type="button">Add L1 Category</button><button className="admin-secondary-button" onClick={() => start(2)} type="button">Add L2 Category</button><button className="admin-secondary-button" onClick={() => start(3)} type="button">Add L3 Category</button></div><span>{categories.length} categories</span></div>
    <div className="category-manager__tree" aria-label="Product category tree">{ordered.map((category) => <article className={`category-manager__row category-manager__row--depth-${category.depth}`} key={category.id}><div><b>{category.name}</b><small>{category.productCount} products</small></div><div><span className={`product-visibility ${category.isActive ? 'is-active' : ''}`}>{category.isActive ? 'Active' : 'Inactive'}</span><button aria-label={`Edit ${category.name}`} className="admin-text-button" onClick={() => edit(category)} type="button">Edit</button><button className="admin-text-button" onClick={() => void onSetActive(category, !category.isActive)} type="button">{category.isActive ? 'Deactivate' : 'Activate'}</button><button aria-label={`Delete ${category.name}`} className="admin-text-button admin-text-button--danger" onClick={() => onDelete(category)} type="button">Delete</button></div></article>)}</div>
    {draft && <AdminModal label={draft.id ? `Edit ${draft.name}` : 'Add category'} onClose={() => setDraft(null)}><form className="product-form category-manager__form" onSubmit={(event) => void submit(event)}><div className="product-form__heading"><div><p className="eyebrow">New level {draft.depth}</p><h2>{draft.depth === 1 ? 'Category' : draft.depth === 2 ? 'Subcategory' : 'Sub-subcategory'}</h2></div><button className="admin-text-button" onClick={() => setDraft(null)} type="button">Close</button></div><div className="product-form__grid"><label>Category name<input aria-label="Category name" onChange={(event) => setDraft({ ...draft, name: event.target.value, slug: slugify(event.target.value) })} value={draft.name} /></label><label>Category slug<input aria-label="Category slug" readOnly value={draft.slug} /></label>{draft.depth > 1 && <label>Parent category<select aria-label="Parent category" onChange={(event) => setDraft({ ...draft, parentId: event.target.value || null })} value={draft.parentId ?? ''}><option value="">Select parent</option>{parentChoices.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}<label>Display order<input aria-label="Category display order" min="0" onChange={(event) => setDraft({ ...draft, displayOrder: Number(event.target.value) })} type="number" value={draft.displayOrder} /></label></div>{error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save category'}</button></form></AdminModal>}
  </section>;
}
