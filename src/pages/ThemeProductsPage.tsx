import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PaletteRow } from '../components/product/PaletteRow';
import { ProductTaxonomy } from '../components/product/ProductTaxonomy';
import { listPublicCatalogue, type PublicCatalogue } from '../lib/public-content';
import { buildPublicTaxonomy } from '../lib/product-taxonomy';
import { getPublicStyleRangeBySlug, type PublicStyleRange } from '../lib/public-style-ranges';
import { listPublicHomeThemeBlocks, type PublicHomeThemeBlock } from '../lib/public-home-theme-blocks';

interface ThemeProductsPageProps {
  themeSlug?: string;
}

export function ThemeProductsPage({ themeSlug: suppliedThemeSlug }: ThemeProductsPageProps) {
  const { themeSlug } = useParams();
  const slug = suppliedThemeSlug ?? themeSlug ?? '';
  const [catalogue, setCatalogue] = useState<PublicCatalogue>({ products: [], categories: [] });
  const [range, setRange] = useState<PublicStyleRange | null | undefined>(undefined);
  const [themeBlock, setThemeBlock] = useState<PublicHomeThemeBlock | null>(null);
  useEffect(() => { let active = true; void Promise.all([listPublicCatalogue(), getPublicStyleRangeBySlug(slug), listPublicHomeThemeBlocks()]).then(([nextCatalogue, nextRange, nextThemeBlocks]) => { if (active) { setCatalogue(nextCatalogue); setRange(nextRange); setThemeBlock(nextThemeBlocks.find((block) => block.rangeSlug === slug) ?? null); } }).catch(() => { if (active) setRange(null); }); return () => { active = false; }; }, [slug]);

  if (range === null) {
    return <section className="content-section editorial"><p className="eyebrow">Products</p><h1>Range unavailable.</h1><p className="lede">This product range is not currently published.</p><Link className="button" to="/">Return home</Link></section>;
  }
  if (!range) return <section className="content-section editorial"><p className="eyebrow">Products</p><p>Loading range…</p></section>;

  const themeProducts = catalogue.products.filter((product) => product.themeSlugs.includes(range.slug));
  const taxonomy = buildPublicTaxonomy(catalogue.categories, themeProducts);

  return (
    <article className={`theme-products theme-products--${range.slug}`}>
      <section className="theme-products__hero">
        {range.heroImageUrl && <img src={range.heroImageUrl} alt="" />}
        <div>
          <p className="eyebrow">{themeBlock?.eyebrow ?? 'IKKO Homes'}</p>
          <h2>{themeBlock?.headline ?? <>Timeless Design.<br />Made for Living.</>}</h2>
        </div>
      </section>
      <section className="theme-products__intro">
        <div className="theme-products__copy">
          <p className="eyebrow primary-section-heading"><span aria-hidden="true" className="primary-section-heading__marker">&gt;</span> {range.eyebrow}</p>
          <h1>{range.headline}</h1>
          <p>{range.description}</p>
          <Link className="button" to={`/products/${range.slug}/cabinetry`}>Order cabinets</Link>
        </div>
        <div className="theme-products__room-image">
          {range.roomImageUrl && <img src={range.roomImageUrl} alt={`${range.name} kitchen interior`} />}
        </div>
      </section>
      <PaletteRow palette={range.palette} />
      <section className="theme-products__collections" aria-label={`${range.name} product collections`}>
        <ProductTaxonomy products={themeProducts} sections={taxonomy} />
      </section>
    </article>
  );
}
