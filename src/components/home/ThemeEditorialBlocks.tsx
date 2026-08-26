import { Link } from 'react-router-dom';
import type { PublicHomeThemeBlock } from '../../lib/public-home-theme-blocks';

export function ThemeEditorialBlocks({ blocks }: { blocks: PublicHomeThemeBlock[] }) {
  if (!blocks.length) return null;
  return <section className="theme-editorial-blocks" aria-label="Explore interior themes">
    {blocks.map((block, index) => <article className={`theme-editorial theme-editorial--${index % 2 ? 'reverse' : 'standard'}`} key={block.id}>
      {block.imageUrl && <img src={block.imageUrl} alt={`${block.rangeName} interior`} />}
      <div className="theme-editorial__copy">
        <p className="eyebrow">{block.eyebrow}</p>
        <h2>{block.headline}</h2>
        <p>{block.description}</p>
        <Link to={`/products/${block.rangeSlug}`}>Explore {block.rangeName}</Link>
      </div>
    </article>)}
  </section>;
}
