import { useCallback, useEffect, useState } from 'react';
import { CategoryManager } from '../../components/admin/CategoryManager';
import { deleteManagedCategory, listManagedCategories, saveManagedCategory, setCategoryActive, type ProductCategorySaveInput } from '../../lib/admin-api';
import type { ManagedProductCategory } from '../../types/domain';

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ManagedProductCategory[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setCategories(await listManagedCategories()); setError(''); } catch { setError('Unable to load product categories.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(input: ProductCategorySaveInput) { await saveManagedCategory(input); await load(); }
  async function updateActive(category: ManagedProductCategory, isActive: boolean) { try { await setCategoryActive(category.id, isActive); await load(); } catch { setError('Unable to update product category.'); } }
  async function remove(category: ManagedProductCategory) { if (!window.confirm(`Permanently delete ${category.name}? This cannot be undone.`)) return; try { await deleteManagedCategory(category.id); await load(); } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete product category.'); } }
  return <section className="admin-dashboard admin-categories-page"><div className="admin-page-heading"><div><p className="eyebrow">Catalogue structure</p><h1>Categories</h1></div><p>Create and organise the three-level product structure used by your public product pages.</p></div>{error && <p className="error" role="alert">{error}</p>}{loading ? <p className="admin-empty">Loading categories…</p> : <CategoryManager categories={categories} onDelete={(category) => void remove(category)} onSave={save} onSetActive={updateActive} />}</section>;
}
