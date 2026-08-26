import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types/catalog';

interface CategoryCarouselProps {
  section?: string;
  title: string;
  products: Product[];
}

const visibleCardCount = 4;
const holdScrollStep = 6;

function distinctCards(products: Product[]) {
  return products.filter((product, index) => products.findIndex(({ id }) => id === product.id) === index);
}

export function CategoryCarousel({ section, title, products }: CategoryCarouselProps) {
  const cards = distinctCards(products);
  const trackRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number>();
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(cards.length > visibleCardCount);
  const headingId = `collection-${title.replace(/\s+/g, '-').toLowerCase()}`;

  const updateControls = () => {
    const track = trackRef.current;
    if (!track) return;
    setCanGoBack(track.scrollLeft > 0);
    setCanGoForward(track.scrollLeft < track.scrollWidth - track.clientWidth - 1);
  };

  const scrollBy = (direction: 1 | -1, amount = holdScrollStep) => {
    trackRef.current?.scrollBy({ left: direction * amount, behavior: 'auto' });
    window.requestAnimationFrame(updateControls);
  };

  const stopHoldScroll = () => {
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = undefined;
  };

  const startHoldScroll = (direction: 1 | -1) => {
    stopHoldScroll();
    scrollBy(direction);
    holdTimer.current = window.setInterval(() => scrollBy(direction), 16);
  };

  useEffect(() => () => stopHoldScroll(), []);

  return (
    <section className="category-carousel" aria-labelledby={headingId}>
      <header className="category-carousel__header">
        {section && <p>{section}</p>}
        <h2 id={headingId}>{title}</h2>
      </header>
      {!cards.length && <p className="category-carousel__empty">Collection coming soon.</p>}
      {!!cards.length && <div className="category-carousel__track-wrap">
        <button aria-label={`Show previous ${title} styles`} className="category-carousel__control" disabled={!canGoBack} onClick={() => scrollBy(-1)} onPointerCancel={stopHoldScroll} onPointerDown={() => startHoldScroll(-1)} onPointerLeave={stopHoldScroll} onPointerUp={stopHoldScroll} type="button"><ChevronLeft size={20} /></button>
        <div className="category-carousel__viewport" onScroll={updateControls} ref={trackRef}>
          <div className="category-carousel__track">
          {cards.map((product) => (
            <Link className="category-carousel__card" key={product.id} to={`/products/${product.slug}`}>
              {product.imageUrl ? <img alt={product.name} className="product-image" src={product.imageUrl} /> : <span aria-label={`${product.name} product visual`} className={`product-image product-image--${product.imageTone}`} role="img" />}
              <h3>{product.name}</h3>
              <p>${product.price.toLocaleString('en-AU')}.00</p>
            </Link>
          ))}
          </div>
        </div>
        <button aria-label={`Show next ${title} styles`} className="category-carousel__control" disabled={!canGoForward} onClick={() => scrollBy(1)} onPointerCancel={stopHoldScroll} onPointerDown={() => startHoldScroll(1)} onPointerLeave={stopHoldScroll} onPointerUp={stopHoldScroll} type="button"><ChevronRight size={20} /></button>
      </div>}
    </section>
  );
}
