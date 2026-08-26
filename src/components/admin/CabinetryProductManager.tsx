import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { getManagedCabinetryProduct, publicAssetUrl, replaceManagedCabinetryImages, saveManagedCabinetryProduct, uploadSiteImage } from '../../lib/admin-api';
import type { ManagedCabinetryProduct } from '../../types/domain';
import { AdminModal } from './AdminModal';
import { GalleryEditor, type GalleryImage } from './GalleryEditor';
import { ImageUpload } from './ImageUpload';
import { ProductDetailContentFields } from './ProductDetailContentFields';
import { normaliseProductDetailContent } from '../../types/product-detail-content';

type CabinetryProductManagerProps = {
  range: { id: string; slug: string; name: string };
  onClose: () => void;
  onChanged: () => void;
};

export function CabinetryProductManager({ range, onClose, onChanged }: CabinetryProductManagerProps) {
  const [product, setProduct] = useState<ManagedCabinetryProduct | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getManagedCabinetryProduct(range.id);
      setProduct(next);
      setGallery((next?.images ?? []).map((image) => ({ id: image.id, path: image.imagePath, sortOrder: image.displayOrder })));
      setHeroFile(null);
      setMessage('');
    } catch {
      setMessage('Unable to load cabinetry product.');
    } finally {
      setLoading(false);
    }
  }, [range.id]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    setSaving(true);
    try {
      const heroImagePath = heroFile ? await uploadSiteImage(`ranges/${range.id}/cabinetry/hero`, heroFile) : product.heroImagePath;
      const imagePaths = await Promise.all(gallery.map(async (image) => image.file ? uploadSiteImage(`ranges/${range.id}/cabinetry/gallery`, image.file) : image.path));
      await saveManagedCabinetryProduct({ id: product.id, styleRangeId: product.styleRangeId, eyebrow: product.eyebrow, headline: product.headline, description: product.description, detailContent: normaliseProductDetailContent(product.detailContent), scope: product.scope, heroImagePath, isActive: product.isActive });
      await replaceManagedCabinetryImages(product.id, imagePaths.filter(Boolean));
      await load();
      onChanged();
      setMessage('Cabinetry product saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save cabinetry product.');
    } finally {
      setSaving(false);
    }
  }

  return <AdminModal label={`Manage ${range.name} Cabinetry`} onClose={onClose}>
    <section className="cabinetry-product-manager">
      <div className="product-form__heading"><div><p className="eyebrow">Quote-Based Product</p><h2>Manage {range.name} Cabinetry</h2></div><button className="admin-text-button" onClick={onClose} type="button">Close</button></div>
      <p className="admin-note">Range: <b>{range.name}</b><br />Price: <b>T.B.D.</b> · no category required<br />Public route: <code>/products/{range.slug}/cabinetry</code></p>
      {message && <p className="admin-notice" role="status">{message}</p>}
      {loading ? <p>Loading cabinetry product…</p> : !product ? <p className="admin-empty">No cabinetry product is available for this range.</p> : <form className="product-form" onSubmit={(event) => void save(event)}>
        <label>Eyebrow<input onChange={(event) => setProduct({ ...product, eyebrow: event.target.value })} value={product.eyebrow} /></label>
        <label>Heading<input onChange={(event) => setProduct({ ...product, headline: event.target.value })} value={product.headline} /></label>
        <label className="product-form__full">Description<textarea onChange={(event) => setProduct({ ...product, description: event.target.value })} value={product.description} /></label>
        <ProductDetailContentFields onChange={(detailContent) => setProduct({ ...product, detailContent })} value={normaliseProductDetailContent(product.detailContent)} />
        <label className="product-form__full">Project scope<input onChange={(event) => setProduct({ ...product, scope: event.target.value })} value={product.scope} /></label>
        <ImageUpload label="Cabinetry hero image" previewSrc={publicAssetUrl('site-assets', product.heroImagePath)} onRemove={() => { setProduct({ ...product, heroImagePath: null }); setHeroFile(null); }} onSelect={setHeroFile} />
        <section className="product-form__full"><h3>Gallery</h3><GalleryEditor images={gallery} onChange={setGallery} previewForPath={(path) => publicAssetUrl('site-assets', path) ?? ''} /></section>
        <label className="product-form__toggle"><input checked={product.isActive} onChange={(event) => setProduct({ ...product, isActive: event.target.checked })} type="checkbox" />Visible on public website</label>
        <button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save cabinetry'}</button>
      </form>}
    </section>
  </AdminModal>;
}
