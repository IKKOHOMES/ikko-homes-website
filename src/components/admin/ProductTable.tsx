import type { ManagedProduct, ManagedProductCategory, ManagedStyleRange } from '../../types/domain';
import { sortManagedProductsByPresentation } from '../../lib/admin-api';

type ProductTableProps = { products: ManagedProduct[]; categories?: ManagedProductCategory[]; styleRanges?: ManagedStyleRange[]; onEdit: (product: ManagedProduct) => void; onArchive: (product: ManagedProduct) => void; onDelete: (product: ManagedProduct) => void };

export function ProductTable({ categories = [], onArchive, onDelete, onEdit, products, styleRanges = [] }: ProductTableProps) {
  if (!products.length) return <p className="admin-empty">No products match this view yet.</p>;
  const orderedProducts = categories.length && styleRanges.length ? sortManagedProductsByPresentation(products, categories, styleRanges) : products;
  return <div className="admin-table-wrap"><table className="admin-table product-table"><thead><tr><th>Product</th><th>Category</th><th>Ranges</th><th>Price</th><th>Public status</th><th /></tr></thead><tbody>{orderedProducts.map((product) => <tr key={product.id}><td><b>{product.name}</b></td><td>{product.category}<small>{product.subcategory}</small></td><td>{product.themeSlugs.map((range) => range.replace(/-/g, ' ')).join(', ')}</td><td>${product.price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td><td><span className={`product-visibility ${product.isActive ? 'is-active' : ''}`}>{product.isActive ? 'Visible' : 'Archived'}</span></td><td className="product-table__actions"><button className="admin-text-button" onClick={() => onEdit(product)} type="button">Edit</button>{product.isActive && <button className="admin-text-button" onClick={() => onArchive(product)} type="button">Archive</button>}<button aria-label={`Delete ${product.name}`} className="admin-text-button admin-text-button--danger" onClick={() => onDelete(product)} type="button">Delete</button></td></tr>)}</tbody></table></div>;
}
