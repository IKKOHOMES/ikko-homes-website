import { Link } from 'react-router-dom';
import type { PublicProduct } from '../../lib/public-content';

export function RelatedProducts({ excludeProductId, products = [] }: { excludeProductId?: string; products?: PublicProduct[] }) {
  const related = products.filter((product) => product.id !== excludeProductId).slice(0, 4);
  if (!related.length) return null;
  return (
    <section className="related-products" aria-labelledby="related-products-title">
      <div className="related-products__heading">
        <p className="eyebrow">Considered pieces</p>
        <h2 id="related-products-title">You may also like</h2>
      </div>
      <div className="related-products__grid">
        {related.map((product) => (
          <Link className="related-products__card" key={product.id} to={`/products/${product.slug}`}>
            {product.imageUrl ? <img alt={product.name} className="product-image" src={product.imageUrl} /> : <span aria-label={`${product.name} product visual`} className={`product-image product-image--${product.imageTone}`} role="img" />}
            <h3>{product.name}</h3>
            <p>${product.price.toLocaleString('en-AU')}.00</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
