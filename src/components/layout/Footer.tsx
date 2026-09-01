import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import ikkoLogo from '../../assets/ikko-logo-primary.png';

function RednoteIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width={size}>
      <rect height="17" rx="4.8" width="20" x="2" y="3.5" />
      <text fill="none" fontFamily="Arial, 'Microsoft YaHei', sans-serif" fontSize="7.2" fontWeight="700" letterSpacing="-.7" stroke="currentColor" strokeWidth=".35" textAnchor="middle" x="12" y="15.1">小红书</text>
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="site-footer site-footer--surface">
      <section className="newsletter" aria-labelledby="newsletter-title">
        <div>
          <h2 id="newsletter-title">Stay inspired.</h2>
          <p>Join our newsletter for design tips, product highlights and exclusive offers.</p>
        </div>
        <form className="newsletter__form">
          <label className="sr-only" htmlFor="newsletter-email">Email address</label>
          <input id="newsletter-email" type="email" placeholder="Enter your email" />
          <button type="submit">Subscribe</button>
        </form>
        <nav className="social-links" aria-label="Social media">
          <a href="https://instagram.com" aria-label="Instagram"><Instagram size={18} /></a>
          <a href="https://facebook.com" aria-label="Facebook"><Facebook size={17} /></a>
          <a href="https://youtube.com" aria-label="YouTube"><Youtube size={18} /></a>
          <a href="https://www.rednote.com" aria-label="Rednote"><RednoteIcon /></a>
        </nav>
      </section>

      <section className="footer-main">
        <div className="footer-brand-block">
          <img className="footer-brand" src={ikkoLogo} alt="IKKO Homes logo" />
          <p>Timeless design. Thoughtful living.</p>
          <p>Made for how you live today.</p>
        </div>

        <nav className="footer-column" aria-label="Products">
          <Link className="footer-column__title" to="/products">Products</Link>
          <Link to="/products/japanese-modern">Japanese Modern</Link>
          <Link to="/products/japandi">Japandi</Link>
          <Link to="/products/organic-modern">Organic Modern</Link>
        </nav>

        <nav className="footer-column" aria-label="Company">
          <Link className="footer-column__title" to="/about">Company</Link>
          <Link to="/about#about-us">About Us</Link>
          <Link to="/about#our-process">Our Process</Link>
          <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
        </nav>

        <address className="footer-column footer-contact">
          <Link className="footer-column__title" to="/contact">Contact</Link>
          <Link to="/contact">Visit Our Studio</Link>
          <span>69 Patricia Loop<br />Keysborough VIC 3173</span>
          <a href="tel:+61490384021">0490 384 021</a>
          <a href="mailto:info@ikkohomes.com.au">info@ikkohomes.com.au</a>
        </address>
      </section>

      <small className="footer-copyright">© 2026 IKKO Homes. All Rights Reserved.</small>
    </footer>
  );
}
