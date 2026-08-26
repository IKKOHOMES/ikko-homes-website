import type { ManagedCabinetryProduct } from '../../types/domain';

type QuoteBasedProductTableProps = {
  products: ManagedCabinetryProduct[];
  onEdit: (product: ManagedCabinetryProduct) => void;
};

export function QuoteBasedProductTable({ products, onEdit }: QuoteBasedProductTableProps) {
  if (!products.length) return <p className="admin-empty">No quote-based products are available yet.</p>;

  return <div className="admin-table-wrap"><table className="admin-table product-table"><thead><tr><th>Product</th><th>Range</th><th>Type</th><th>Price</th><th>Public status</th><th /></tr></thead><tbody>
    {products.map((product) => <tr key={product.id}><td><b>{product.headline}</b><small>Drawing upload required</small></td><td>{product.rangeName}</td><td>Quote-Based Product</td><td>T.B.D.</td><td><span className={`product-visibility ${product.isActive ? 'is-active' : ''}`}>{product.isActive ? 'Visible' : 'Archived'}</span></td><td className="product-table__actions"><button className="admin-text-button" onClick={() => onEdit(product)} type="button">Edit {product.headline}</button></td></tr>)}
  </tbody></table></div>;
}
