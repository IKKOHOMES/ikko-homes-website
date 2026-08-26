import { ChevronDown, Search, ShoppingBag, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { themes } from '../../data/themes';
import ikkoHeaderLogo from '../../assets/ikko-logo-header.png';
import { SiteSearchModal } from './SiteSearchModal';

export function Header() {
  const { count } = useCart();
  const { pathname } = useLocation();
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isHeroPage = pathname === '/' || pathname === '/products' || themes.some((theme) => pathname === `/products/${theme.slug}`);

  useEffect(() => {
    setIsProductsOpen(false);
  }, [pathname]);

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
        <Link aria-label={`Cart ${count} items`} to="/cart"><ShoppingBag size={19} /></Link>
      </div>
    </header>
    {isSearchOpen && <SiteSearchModal onClose={() => setIsSearchOpen(false)} />}
  </>;
}
