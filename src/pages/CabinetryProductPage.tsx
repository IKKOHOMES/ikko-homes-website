import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DetailTabs } from '../components/product/DetailTabs';
import { useCart } from '../context/CartContext';
import { getPublicCabinetryProductByRangeSlug, type PublicCabinetryProduct } from '../lib/public-cabinetry-products';
import type { CabinetryUpload } from '../types/order';

const galleryFrames = ['front', 'side', 'detail', 'material'];

function CabinetryGallery({ product }: { product: PublicCabinetryProduct }) {
  const [active, setActive] = useState(0);
  const images = [product.heroImageUrl, ...product.galleryImageUrls].filter((image): image is string => Boolean(image));
  if (!images.length) {
    return <div className="detail-gallery"><div aria-label={`${product.name} product visual`} className={`detail-gallery__main detail-gallery__main--${galleryFrames[active]} product-image product-image--cabinetry`} role="img"><span aria-hidden="true" className="detail-gallery__zoom">⌕</span><span aria-hidden="true" className="detail-gallery__frame-label">Bespoke cabinetry</span></div><div className="detail-gallery__thumbs" aria-label="Product images">{galleryFrames.map((frame, index) => <button aria-label={`View ${frame} view`} className={active === index ? 'is-active' : ''} key={frame} onClick={() => setActive(index)} type="button"><span aria-hidden="true" className={`product-image product-image--cabinetry detail-gallery__thumb detail-gallery__thumb--${frame}`} /></button>)}</div></div>;
  }
  return <div className="detail-gallery"><div className="detail-gallery__main"><img alt={`${product.name} image ${active + 1}`} src={images[active] ?? images[0]} /><span aria-hidden="true" className="detail-gallery__zoom">⌕</span></div><div className="detail-gallery__thumbs" aria-label="Product images">{images.map((image, index) => <button aria-label={`View image ${index + 1}`} className={active === index ? 'is-active' : ''} key={image} onClick={() => setActive(index)} type="button"><img alt="" src={image} /></button>)}</div></div>;
}

function CabinetryTrustRow() {
  return <div className="trust-row"><span><b>▱</b>Drawing review<small>Before quotation</small></span><span><b>♢</b>Secure order<small>No online payment</small></span><span><b>↻</b>Studio support<small>Here to help</small></span></div>;
}

export function CabinetryProductPage() {
  const rangeSlug = useParams().rangeSlug ?? '';
  const [product, setProduct] = useState<PublicCabinetryProduct | null | undefined>(undefined);
  const [upload, setUpload] = useState<CabinetryUpload | null>(null);
  const [error, setError] = useState('');
  const { addCabinetry } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setProduct(undefined);
    void getPublicCabinetryProductByRangeSlug(rangeSlug).then((next) => { if (active) setProduct(next); }).catch(() => { if (active) setProduct(null); });
    return () => { active = false; };
  }, [rangeSlug]);

  const onFile = (file?: File) => {
    if (!file) return;
    const filenameAllowed = /\.(pdf|dwg|jpe?g|png)$/i.test(file.name);
    if (file.size > 25 * 1024 * 1024 || !filenameAllowed) {
      setUpload(null);
      setError('Please upload a PDF, DWG, JPG or PNG under 25 MB.');
      return;
    }
    setError('');
    setUpload({ id: `${file.name}-${Date.now()}`, name: file.name, size: file.size, type: file.type, file });
  };

  if (product === undefined) return <section className="content-section editorial"><p>Loading cabinetry…</p></section>;
  if (!product) return <section className="content-section editorial"><p className="eyebrow">Products</p><h1>Cabinetry product unavailable.</h1><p className="lede">This cabinetry product is not currently published.</p><Link className="button" to="/products">Return to products</Link></section>;

  return <section className="detail-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>›</span><Link to="/products">Products</Link><span>›</span><Link to={`/products/${product.rangeSlug}`}>{product.rangeName}</Link><span>›</span><span>{product.name}</span></nav>
    <div className="detail-layout"><CabinetryGallery product={product} /><aside className="purchase-panel"><p className="eyebrow">{product.eyebrow}</p><h1>{product.name}</h1><p className="price">T.B.D.</p><p className="rating">★★★★★ <span>Design-led joinery</span></p><p className="purchase-panel__description">{product.description}</p><hr /><div className="cabinetry-scope"><b>Project scope</b><p>{product.scope}</p></div><label className="upload" htmlFor="drawing"><span>Upload your drawings</span><input id="drawing" aria-label="Upload drawings" type="file" accept=".pdf,.dwg,.jpg,.jpeg,.png" onChange={(event) => onFile(event.target.files?.[0])} /><small>{upload ? `✓ ${upload.name}` : 'PDF, DWG, JPG or PNG · up to 25 MB'}</small></label>{error && <p className="error">{error}</p>}<button disabled={!upload} className="button detail-add" onClick={() => { if (upload) { addCabinetry(product, upload); navigate('/cart'); } }}>Add {product.name} to cart</button><CabinetryTrustRow /></aside></div>
    <DetailTabs detailContent={product.detailContent} isCabinetry productName={product.name} />
  </section>;
}
