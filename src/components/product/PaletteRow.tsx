import type { PublicPaletteItem } from '../../lib/public-style-ranges';

interface PaletteRowProps {
  palette: PublicPaletteItem[];
}

export function PaletteRow({ palette }: PaletteRowProps) {
  return (
    <section className="theme-palette" aria-labelledby="palette-heading">
      <h2 id="palette-heading"><span aria-hidden="true" className="primary-section-heading__marker">&gt;</span> Complementary Wall &amp; Floor Finishes</h2>
      <div className="theme-palette__swatches">
        {palette.map((item) => (
          <article className="theme-palette__swatch" key={item.id}>
            <span aria-label={`${item.name} material`} role="img" style={item.imageUrl ? { backgroundColor: item.colour, backgroundImage: `url(${item.imageUrl})` } : { backgroundColor: item.colour }} />
            <p>{item.name}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
