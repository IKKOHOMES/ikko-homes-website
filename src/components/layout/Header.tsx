import { ChevronDown, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { themes } from '../../data/themes';
import ikkoHeaderLogo from '../../assets/ikko-logo-header.png';
import { SiteSearchModal } from './SiteSearchModal';

function formatPrice(value: number) {
  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Header() {
  const { count, lines, removeLine } = useCart();
  const { pathname } = useLocation();
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);
  const isHeroPage = pathname === '/' || pathname === '/products' || themes.some((theme) => pathname === `/products/${theme.slug}`);
  const hasQuoteBasedProduct = lines.some((line) => line.kind === 'cabinetry');
  const pricedTotal = lines.reduce((total, line) => total + (line.kind === 'furniture' ? line.price * line.quantity : 0), 0);

  useEffect(() => {
    setIsProductsOpen(false);
    setIsCartOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isCartOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!cartRef.current?.contains(event.target as Node)) setIsCartOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isCartOpen]);

  useEffect(() => {
    const openCart = () => setIsCartOpen(true);
    window.addEventListener('cart:open', openCart);
    return () => window.removeEventListener('cart:open', openCart);
  }, []);

  return <>
    <header className={`site-header${isHeroPage ? ' site-header--overlay' : ' site-header--surface'}`}>
      <Link className="brand" to="/" aria-label="IKKO Homes">
        <img className="brand__logo" src={ikkoHeaderLogo} alt="IKKO Homes logo" />
      </Link>
      <nav aria-label="Primary navigation" className="primary-nav">
        <Link to="/">Home</Link>
        <div className="products-menu">
          <button className="products-menu__trigger" type="button" aria-expanded={isProductsOpen} aria-controls="products-dropdown" onClick={() => setIsProductsOpen((open) => !open)}>
            Products
            {isProductsOpen ? <ChevronDown aria-hidden="true" size={13} /> : null}
          </button>
          <ul id="products-dropdown" className="products-dropdown" aria-label="Product themes" hidden={!isProductsOpen}>
            {themes.map((theme) => <li key={theme.slug}><Link to={`/products/${theme.slug}`}>{theme.name}</Link></li>)}
          </ul>
        </div>
        <Link to="/projects">Projects</Link>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </nav>
      <div className="header-actions" aria-label="Utilities">
        <Link aria-label="Account" to="/account"><UserRound size={18} /></Link>
        <button aria-label="Search" onClick={() => setIsSearchOpen(true)} type="button"><Search size={18} /></button>
        <div className="mini-cart" ref={cartRef}>
          <button aria-label={`Cart ${count} items`} aria-expanded={isCartOpen} className="mini-cart__trigger" onClick={() => setIsCartOpen((open) => !open)} type="button">
            <ShoppingBag size={19} />
            {count > 0 && <span aria-label={`${count} items`} className="mini-cart__count">{count}</span>}
          </button>
          {isCartOpen && <div aria-label="Shopping cart" className="mini-cart__panel">
            <div className="mini-cart__heading"><b>Cart</b><button aria-label="Close cart" onClick={() => setIsCartOpen(false)} type="button"><X size={16} /></button></div>
            {lines.length === 0 ? <p className="mini-cart__empty">Your cart is empty.</p> : <>
              <div className="mini-cart__lines">
                {lines.map((line) => <article className="mini-cart__line" key={line.id}>
                  <div><b>{line.name}</b><small>{line.quantity} × {line.kind === 'cabinetry' ? 'Quote based' : formatPrice(line.price)}</small></div>
                  <div><span>{line.kind === 'cabinetry' ? 'T.B.D.' : formatPrice(line.price * line.quantity)}</span><button aria-label={`Remove ${line.name}`} onClick={() => removeLine(line.id)} type="button">Remove</button></div>
                </article>)}
              </div>
              <div className="mini-cart__total"><span>Total</span><b>{hasQuoteBasedProduct ? 'T.B.D.' : formatPrice(pricedTotal)}</b></div>
              <Link className="button mini-cart__checkout" onClick={() => setIsCartOpen(false)} to="/order">Checkout</Link>
            </>}
          </div>}
        </div>
      </div>
    </header>
    {isSearchOpen && <SiteSearchModal onClose={() => setIsSearchOpen(false)} />}
  </>;
}
