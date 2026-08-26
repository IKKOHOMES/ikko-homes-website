import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { FeaturedProjects } from './components/home/FeaturedProjects';
import { ServicePillars } from './components/home/ServicePillars';
import { ThemeEditorialBlocks } from './components/home/ThemeEditorialBlocks';
import { CartProvider, useCart } from './context/CartContext';
import { listPublicProjects, type PublicProject } from './lib/public-projects';
import { listPublicCatalogue, type PublicProduct } from './lib/public-content';
import { listPublicHomeContent, listPublicServicePillars, type PublicHomeContent, type PublicServicePillar } from './lib/public-home-content';
import { listPublicHomeThemeBlocks, type PublicHomeThemeBlock } from './lib/public-home-theme-blocks';
import { submitOrder } from './lib/order-submission';
import { ThemeProductsPage } from './pages/ThemeProductsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { TermsPage } from './pages/TermsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminModulePage } from './pages/admin/AdminModulePage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminCustomerDetailPage } from './pages/admin/AdminCustomerDetailPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminProjectsPage } from './pages/admin/AdminProjectsPage';
import { AdminBlogsPage } from './pages/admin/AdminBlogsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminContentPage } from './pages/admin/AdminContentPage';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { AdminRoute } from './components/admin/AdminRoute';
import { DetailTabs } from './components/product/DetailTabs';
import { RelatedProducts } from './components/product/RelatedProducts';
import type { CustomerDetails } from './types/order';
import { CustomerAuthPage } from './pages/CustomerAuthPage';
import { CustomerInvoicePage } from './pages/CustomerInvoicePage';
import { CabinetryProductPage } from './pages/CabinetryProductPage';

export function App() {
  return (
    <BrowserRouter><AdminAuthProvider><CustomerAuthProvider>
      <CartProvider><AppRoutes /></CartProvider>
    </CustomerAuthProvider></AdminAuthProvider></BrowserRouter>
  );
}

function AppRoutes() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin');
  return <div className={`app-shell${isAdminRoute ? ' app-shell--admin' : ''}`}>
    {!isAdminRoute && <Header />}
    <main className="page-shell"><Routes>
        <Route path="/" element={<Home />} /><Route path="/products" element={<ThemeProductsPage themeSlug="japandi" />} />
        <Route path="/products/japanese-modern" element={<ThemeProductsPage themeSlug="japanese-modern" />} /><Route path="/products/japandi" element={<ThemeProductsPage themeSlug="japandi" />} /><Route path="/products/organic-modern" element={<ThemeProductsPage themeSlug="organic-modern" />} />
        <Route path="/products/:rangeSlug/cabinetry" element={<CabinetryProductPage />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/cart" element={<CartPage />} /><Route path="/confirmation" element={<Confirmation />} />
        <Route path="/projects" element={<ProjectsDirectory />} /><Route path="/projects/:slug" element={<ProjectDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms-and-conditions" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/account" element={<CustomerAuthPage />} />
        <Route path="/account/invoices/:invoiceId" element={<CustomerInvoicePage />} />
        <Route path="/admin" element={<Navigate replace to="/admin/dashboard" />} />
        <Route path="/admin/login" element={<Navigate replace to="/account?mode=admin" />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminOrdersPage /></AdminRoute>} />
        <Route path="/admin/orders/:id" element={<AdminRoute><AdminOrderDetailPage /></AdminRoute>} />
        <Route path="/admin/customers" element={<AdminRoute><AdminCustomersPage /></AdminRoute>} />
        <Route path="/admin/customers/:id" element={<AdminRoute><AdminCustomerDetailPage /></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminProductsPage /></AdminRoute>} />
        <Route path="/admin/categories" element={<AdminRoute><AdminCategoriesPage /></AdminRoute>} />
        <Route path="/admin/projects" element={<AdminRoute><AdminProjectsPage /></AdminRoute>} />
        <Route path="/admin/blogs" element={<AdminRoute><AdminBlogsPage /></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
        <Route path="/admin/content" element={<AdminRoute><AdminContentPage /></AdminRoute>} />
        <Route path="*" element={<Editorial title="Page not found." copy="The page you are looking for does not exist." />} />
    </Routes></main>
    {!isAdminRoute && <Footer />}
  </div>;
}

function Home() {
  const [content, setContent] = useState<PublicHomeContent | null>(null); const [pillars, setPillars] = useState<PublicServicePillar[]>([]); const [themeBlocks, setThemeBlocks] = useState<PublicHomeThemeBlock[]>([]);
  useEffect(() => {
    let active = true;
    void listPublicHomeContent().then((home) => { if (active) setContent(home); }).catch(() => undefined);
    void listPublicServicePillars().then((services) => { if (active) setPillars(services); }).catch(() => undefined);
    void listPublicHomeThemeBlocks().then((blocks) => { if (active) setThemeBlocks(blocks); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <>
    {content && <section className="home-hero">
      {content.heroImageUrl && <img src={content.heroImageUrl} alt="IKKO Homes interior" />}
      <div className="home-hero__copy"><p className="eyebrow">{content.heroEyebrow}</p><h1>{content.heroHeading}</h1><Link className="button" to={content.heroCtaPath}>{content.heroCtaLabel}</Link></div>
    </section>}
    <ServicePillars pillars={pillars} />
    <ThemeEditorialBlocks blocks={themeBlocks} />
    <FeaturedProjects />
  </>;
}
const galleryFrames = ['front', 'side', 'detail', 'material'];

function Breadcrumbs({ productName }: { productName: string }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>›</span><Link to="/products">Products</Link><span>›</span><span>{productName}</span></nav>;
}

function ProductGallery({ label, imageUrls = [], imageTone }: { label: string; imageUrls?: string[]; imageTone?: string }) {
  const [active, setActive] = useState(0);
  const images = imageUrls.length ? imageUrls : [];
  return <div className="detail-gallery">{images.length ? <><div className="detail-gallery__main"><img alt={`${label} image ${active + 1}`} src={images[active] ?? images[0]} /><span aria-hidden="true" className="detail-gallery__zoom">⌕</span></div><div className="detail-gallery__thumbs" aria-label="Product images">{images.map((image, index) => <button aria-label={`View image ${index + 1}`} className={active === index ? 'is-active' : ''} key={image} onClick={() => setActive(index)} type="button"><img alt="" src={image} /></button>)}</div></> : imageTone ? <><div aria-label={`${label} product visual`} className={`detail-gallery__main detail-gallery__main--${galleryFrames[active]} product-image product-image--${imageTone}`} role="img"><span aria-hidden="true" className="detail-gallery__zoom">⌕</span></div><div className="detail-gallery__thumbs" aria-label="Product images">{galleryFrames.map((frame, index) => <button aria-label={`View ${frame} view`} className={active === index ? 'is-active' : ''} key={frame} onClick={() => setActive(index)} type="button"><span aria-hidden="true" className={`product-image product-image--${imageTone} detail-gallery__thumb detail-gallery__thumb--${frame}`} /></button>)}</div></> : <p className="detail-gallery__empty">Product imagery coming soon.</p>}</div>;
}

function TrustRow({ cabinetry = false }: { cabinetry?: boolean }) {
  return <div className="trust-row"><span><b>▱</b>{cabinetry ? 'Drawing review' : 'Free delivery'}<small>{cabinetry ? 'Before quotation' : 'On orders over $150'}</small></span><span><b>♢</b>Secure order<small>No online payment</small></span><span><b>↻</b>Studio support<small>Here to help</small></span></div>;
}

function ProductDetail() {
  const slug = useParams().slug ?? ''; const [product, setProduct] = useState<PublicProduct | null | undefined>(undefined); const [related, setRelated] = useState<PublicProduct[]>([]);
  const { addFurniture } = useCart(); const navigate = useNavigate();
  const [finish, setFinish] = useState(product?.finishes[0] ?? ''); const [quantity, setQuantity] = useState(1);
  useEffect(() => { let active = true; setProduct(undefined); void listPublicCatalogue().then((catalogue) => { if (active) { const current = catalogue.products.find((item) => item.slug === slug) ?? null; setProduct(current); setRelated(catalogue.products.filter((item) => item.slug !== slug).slice(0, 4)); } }).catch(() => { if (active) setProduct(null); }); return () => { active = false; }; }, [slug]);
  useEffect(() => { setFinish(product?.finishes[0] ?? ''); setQuantity(1); }, [product?.slug]);
  if (product === undefined) return <section className="content-section editorial"><p>Loading product…</p></section>;
  if (!product) return <Editorial title="Product not found." copy="Please return to our product collection." />;
  const images = [product.imageUrl, ...product.galleryImageUrls].filter((image): image is string => Boolean(image));
  return <section className="detail-page"><Breadcrumbs productName={product.name} /><div className="detail-layout"><ProductGallery imageTone={product.imageTone} imageUrls={images} label={product.name} /><aside className="purchase-panel"><p className="eyebrow">Furniture</p><h1>{product.name}</h1><p className="price">${product.price.toLocaleString('en-AU')}.00</p><p className="rating">★★★★★ <span>(28 reviews)</span></p><p className="purchase-panel__description">{product.description}</p><hr /><div className="finish-choice"><p><b>Colour:</b> {finish}</p><div>{product.finishes.map((option, index) => <button aria-label={option} className={`finish-dot finish-dot--${index} ${finish === option ? 'is-active' : ''}`} key={option} onClick={() => setFinish(option)} type="button" />)}</div></div><div className="quantity-choice"><b>Quantity</b><div><button aria-label="Decrease quantity" disabled={quantity === 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button">−</button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity((value) => value + 1)} type="button">+</button></div></div><button className="button detail-add" onClick={() => { addFurniture(product, finish, quantity); navigate('/cart'); }}>Add to cart</button><button className="wishlist-button" type="button">♡ Add to wishlist</button><TrustRow /></aside></div><DetailTabs detailContent={product.detailContent} isCabinetry={false} productName={product.name} /><RelatedProducts excludeProductId={product.id} products={related} /></section>;
}

function CartPage() { const { lines, removeLine, clear } = useCart(); const navigate = useNavigate(); const hasCabinetry = lines.some((line) => line.kind === 'cabinetry'); const cabinetryNames = lines.filter((line) => line.kind === 'cabinetry').map((line) => line.name).join(', '); const [form, setForm] = useState<CustomerDetails>({ firstName:'',lastName:'',email:'',phone:'',address:'',note:'' }); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false); const subtotal = lines.reduce((total,line) => total + (line.kind === 'furniture' ? line.price * line.quantity : 0),0); if (!lines.length) return <Editorial title="Your cart is waiting." copy="Explore furniture or upload a cabinetry drawing to begin." />; const submit = async () => { if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.address) { setError('Please complete your contact and project details.'); return; } setSubmitting(true); setError(''); try { const order = await submitOrder(lines, form); clear(); navigate('/confirmation', { state: order }); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'We could not submit your order.'); } finally { setSubmitting(false); } }; return <section className="cart-page"><div><p className="eyebrow">Your cart</p><h1>Review your order.</h1><div className="cart-lines">{lines.map((line) => <article className="cart-line" key={line.id}><div className={`mini-image product-image--${line.imageTone}`} /><div><h3>{line.name}</h3><p>{line.kind === 'cabinetry' ? `Drawing attached: ${line.upload.name}` : line.finish}</p></div><b>{line.kind === 'cabinetry' ? 'T.B.D.' : `$${line.price.toLocaleString('en-AU')}.00`}</b><button onClick={() => removeLine(line.id)}>Remove</button></article>)}</div><h2>Your details</h2><div className="form-grid">{(['firstName','lastName','email','phone','address'] as const).map((field) => <input key={field} placeholder={field === 'firstName' ? 'First name' : field === 'lastName' ? 'Last name' : field === 'email' ? 'Email address' : field === 'phone' ? 'Phone number' : 'Delivery / project address'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />)}<textarea placeholder="Order notes (optional)" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></div></div><aside className="summary"><h2>Order summary</h2><p>Furniture <b>${subtotal.toLocaleString('en-AU')}.00</b></p>{hasCabinetry && <p>{cabinetryNames} <b className="orange">T.B.D.</b></p>}<hr /><p className="due">Amount due today <b>{hasCabinetry ? '$0.00' : `$${subtotal.toLocaleString('en-AU')}.00`}</b></p>{hasCabinetry && <small>We’ll prepare a quotation after reviewing your cabinetry drawing.</small>}{error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={submitting} onClick={() => void submit()}>{submitting ? 'Submitting…' : hasCabinetry ? 'Confirm order & request quotation' : 'Confirm order & receive invoice'}</button></aside></section> }
function Confirmation() { const { state } = useLocation() as { state?: { orderNumber?: string; documentKind?: 'invoice' | 'quote-pending' } }; const cabinetry = state?.documentKind === 'quote-pending'; return <Editorial title="Thank you for your order." copy={state?.orderNumber ? `${state.orderNumber} has been received. ${cabinetry ? 'We will review your cabinetry drawing and prepare a quotation.' : 'Your invoice has been created; our studio will be in touch shortly.'}` : 'Your confirmation has been prepared. Check your inbox for the next step.'} /> }
function ProjectsDirectory() { const [cloudProjects, setCloudProjects] = useState<PublicProject[]>([]); useEffect(() => { let active = true; void listPublicProjects().then((value) => { if (active) setCloudProjects(value ?? []); }).catch(() => undefined); return () => { active = false; }; }, []); return <section className="content-section editorial projects-directory"><p className="eyebrow">Featured Projects</p><h1>Inspired spaces. Real homes.</h1><p className="lede">A considered collection of IKKO Homes projects across Australia.</p>{!cloudProjects.length && <p className="admin-empty">No projects are currently published.</p>}<div className="project-grid">{cloudProjects.map((project) => <Link key={project.id} className="project-card" to={`/projects/${project.slug}`}>{project.coverImageUrl ? <img alt={project.name} className="project-image" src={project.coverImageUrl} /> : <span aria-label={`${project.name} project visual`} className={`project-image project-image--${project.imageTone}`} role="img" />}<h3>{project.name}</h3><p>{project.location}</p></Link>)}</div></section> }
function Editorial({ title, copy }: { title: string; copy: string }) { return <section className="content-section editorial"><p className="eyebrow">IKKO Homes</p><h1>{title}</h1><p className="lede">{copy}</p><Link className="button" to="/">Return home</Link></section> }
