import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ImageUpload } from '../../components/admin/ImageUpload';
import { AdminModal } from '../../components/admin/AdminModal';
import { PaletteManager } from '../../components/admin/PaletteManager';
import {
  getManagedHomeContent, importExistingSampleContent, listManagedHomeThemeBlocks, listManagedServicePillars,
  listManagedStyleRanges, publicAssetUrl, saveManagedHomeContent, saveManagedHomeThemeBlock,
  saveManagedServicePillar, saveManagedStyleRange, setHomeThemeBlockActive, setServicePillarActive,
  setStyleRangeActive, uploadSiteImage,
} from '../../lib/admin-api';
import { slugify } from '../../lib/slug';
import type { ManagedHomeContent, ManagedHomeThemeBlock, ManagedServicePillar, ManagedStyleRange } from '../../types/domain';

const emptyHome: ManagedHomeContent = { heroEyebrow: '', heroHeading: '', heroCtaLabel: '', heroCtaPath: '/contact', heroImagePath: null };
const blankRange = (): Omit<ManagedStyleRange, 'id'> => ({ slug: '', name: '', eyebrow: '', headline: '', description: '', heroImagePath: null, roomImagePath: null, palette: ['#d9d6d0', '#b78b5d', '#e5d4be', '#c9c7c3', '#dfd9d1'], displayOrder: 0, isActive: true });
const blankPillar = (): Omit<ManagedServicePillar, 'id'> => ({ title: '', description: '', iconKey: 'consultation', displayOrder: 0, isActive: true });
const blankThemeBlock = (): Omit<ManagedHomeThemeBlock, 'id' | 'rangeSlug' | 'rangeName'> => ({ styleRangeId: '', eyebrow: '', headline: '', description: '', imagePath: null, displayOrder: 0, isActive: true });
type EditableThemeBlock = Omit<ManagedHomeThemeBlock, 'id' | 'rangeSlug' | 'rangeName'> & { id?: string };

export function AdminContentPage() {
  const [home, setHome] = useState<ManagedHomeContent>(emptyHome);
  const [pillars, setPillars] = useState<ManagedServicePillar[]>([]);
  const [ranges, setRanges] = useState<ManagedStyleRange[]>([]);
  const [themeBlocks, setThemeBlocks] = useState<ManagedHomeThemeBlock[]>([]);
  const [range, setRange] = useState<(Omit<ManagedStyleRange, 'id'> & { id?: string }) | null>(null);
  const [themeBlock, setThemeBlock] = useState<EditableThemeBlock | null>(null);
  const [paletteRange, setPaletteRange] = useState<ManagedStyleRange | null>(null);
  const [pillar, setPillar] = useState<(Omit<ManagedServicePillar, 'id'> & { id?: string }) | null>(null);
  const [homeFile, setHomeFile] = useState<File | null>(null);
  const [themeBlockFile, setThemeBlockFile] = useState<File | null>(null);
  const [rangeHeroFile, setRangeHeroFile] = useState<File | null>(null);
  const [rangeRoomFile, setRangeRoomFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHome, nextPillars, nextRanges, nextBlocks] = await Promise.all([
        getManagedHomeContent(), listManagedServicePillars(), listManagedStyleRanges(), listManagedHomeThemeBlocks(),
      ]);
      setHome(nextHome ?? emptyHome); setPillars(nextPillars); setRanges(nextRanges); setThemeBlocks(nextBlocks); setMessage('');
    } catch { setMessage('Unable to load content.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveHome(event: FormEvent) {
    event.preventDefault();
    try {
      let heroImagePath = home.heroImagePath;
      if (homeFile) heroImagePath = await uploadSiteImage('home', homeFile);
      await saveManagedHomeContent({ ...home, heroImagePath }); setHome((current) => ({ ...current, heroImagePath })); setHomeFile(null); setMessage('Homepage saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save homepage content.'); }
  }
  async function saveThemeBlock(event: FormEvent) {
    event.preventDefault(); if (!themeBlock) return;
    try {
      let imagePath = themeBlock.imagePath;
      if (themeBlockFile) imagePath = await uploadSiteImage(`home/theme-blocks/${themeBlock.id ?? (themeBlock.styleRangeId || 'new')}`, themeBlockFile);
      await saveManagedHomeThemeBlock({ ...themeBlock, imagePath }); setThemeBlock(null); setThemeBlockFile(null); await load(); setMessage('Homepage theme block saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save homepage theme block.'); }
  }
  async function saveRange(event: FormEvent) {
    event.preventDefault(); if (!range) return;
    try {
      const owner = range.id ?? (range.slug || 'range'); let heroImagePath = range.heroImagePath; let roomImagePath = range.roomImagePath;
      if (rangeHeroFile) heroImagePath = await uploadSiteImage(`${owner}/hero`, rangeHeroFile);
      if (rangeRoomFile) roomImagePath = await uploadSiteImage(`${owner}/room`, rangeRoomFile);
      await saveManagedStyleRange({ ...range, heroImagePath, roomImagePath }); setRange(null); setRangeHeroFile(null); setRangeRoomFile(null); await load(); setMessage('Product range saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save product range.'); }
  }
  async function savePillar(event: FormEvent) {
    event.preventDefault(); if (!pillar) return;
    try { await saveManagedServicePillar(pillar); setPillar(null); await load(); setMessage('Homepage service saved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save homepage service.'); }
  }
  async function runImport() {
    setImporting(true);
    try { const result = await importExistingSampleContent(); await load(); setMessage(`Imported ${result.created} images and ${result.recordsCreated} records; skipped ${result.skipped + result.recordsSkipped}; failed ${result.failed}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to import sample content.'); } finally { setImporting(false); }
  }
  if (loading) return <section className="admin-dashboard">Loading content…</section>;

  return <section className="admin-dashboard admin-content-page">
    <div className="admin-page-heading"><div><p className="eyebrow">Storefront content</p><h1>Content</h1></div><p>Manage every public homepage and product-range image or word from the cloud.</p></div>
    {message && <p className="admin-notice" role="status">{message}</p>}
    <section className="admin-content-card"><div><p className="eyebrow">Homepage</p><h2>Homepage content</h2></div><form className="product-form" onSubmit={(event) => void saveHome(event)}><label>Eyebrow<input value={home.heroEyebrow} onChange={(event) => setHome({ ...home, heroEyebrow: event.target.value })} /></label><label>Heading<input value={home.heroHeading} onChange={(event) => setHome({ ...home, heroHeading: event.target.value })} /></label><label>CTA label<input value={home.heroCtaLabel} onChange={(event) => setHome({ ...home, heroCtaLabel: event.target.value })} /></label><label>CTA route<input value={home.heroCtaPath} onChange={(event) => setHome({ ...home, heroCtaPath: event.target.value })} /></label><ImageUpload label="Homepage hero" previewSrc={publicAssetUrl('site-assets', home.heroImagePath)} onRemove={() => { setHome({ ...home, heroImagePath: null }); setHomeFile(null); }} onSelect={setHomeFile} /><button className="button" type="submit">Save homepage</button></form></section>
    <section className="admin-content-card"><div className="admin-toolbar"><div><p className="eyebrow">Homepage</p><h2>Service pillars</h2></div><button className="button" onClick={() => setPillar(blankPillar())} type="button">Add service</button></div><div className="admin-list">{pillars.map((item) => <article key={item.id}><div><b>{item.title}</b><p>{item.description}</p></div><div aria-label={`${item.title} actions`} className="admin-action-group" role="group"><button className="admin-text-button" onClick={() => setPillar(item)} type="button">Edit</button><button className="admin-text-button" onClick={() => void setServicePillarActive(item.id, !item.isActive).then(load)} type="button">{item.isActive ? 'Hide' : 'Show'}</button></div></article>)}</div>{pillar && <AdminModal label={pillar.id ? `Edit ${pillar.title}` : 'Add service'} onClose={() => setPillar(null)}><form className="product-form" onSubmit={(event) => void savePillar(event)}><div className="product-form__heading"><h2>{pillar.id ? 'Edit service' : 'Add service'}</h2><button className="admin-text-button" onClick={() => setPillar(null)} type="button">Close</button></div><label>Title<input value={pillar.title} onChange={(event) => setPillar({ ...pillar, title: event.target.value })} /></label><label>Display order<input min="0" type="number" value={pillar.displayOrder} onChange={(event) => setPillar({ ...pillar, displayOrder: Number(event.target.value) })} /></label><label className="product-form__full">Description<textarea value={pillar.description} onChange={(event) => setPillar({ ...pillar, description: event.target.value })} /></label><label>Icon<select value={pillar.iconKey} onChange={(event) => setPillar({ ...pillar, iconKey: event.target.value as ManagedServicePillar['iconKey'] })}>{['consultation', 'joinery', 'furniture', 'delivery'].map((key) => <option key={key} value={key}>{key}</option>)}</select></label><label className="product-form__toggle"><input checked={pillar.isActive} type="checkbox" onChange={(event) => setPillar({ ...pillar, isActive: event.target.checked })} />Visible on public website</label><button className="button" type="submit">Save service</button></form></AdminModal>}</section>
    <section className="admin-content-card"><div className="admin-toolbar"><div><p className="eyebrow">Homepage</p><h2>Homepage theme blocks</h2></div><button className="button" onClick={() => setThemeBlock(blankThemeBlock())} type="button">Add homepage theme block</button></div><p>These editorial blocks are shown on the homepage only. Their range destination is a link; the wording and image stay independent from the product range.</p><div className="admin-list">{themeBlocks.map((item) => <article key={item.id}><div><b>{item.rangeName}</b><p>{item.isActive ? 'Visible' : 'Hidden'}</p></div><div aria-label={`${item.rangeName} homepage theme block actions`} className="admin-action-group" role="group"><button className="admin-text-button" onClick={() => setThemeBlock(item)} type="button">Edit</button><button className="admin-text-button" onClick={() => void setHomeThemeBlockActive(item.id, !item.isActive).then(load)} type="button">{item.isActive ? 'Hide' : 'Show'}</button></div></article>)}</div>{themeBlock && <AdminModal label={themeBlock.id ? `Edit ${themeBlock.headline}` : 'Add homepage theme block'} onClose={() => setThemeBlock(null)}><form className="product-form" onSubmit={(event) => void saveThemeBlock(event)}><div className="product-form__heading"><h2>{themeBlock.id ? 'Edit homepage theme block' : 'Add homepage theme block'}</h2><button className="admin-text-button" onClick={() => setThemeBlock(null)} type="button">Close</button></div><label>Range destination<select value={themeBlock.styleRangeId} onChange={(event) => setThemeBlock({ ...themeBlock, styleRangeId: event.target.value })}><option value="">Choose a range</option>{ranges.filter((item) => !themeBlocks.some((block) => block.styleRangeId === item.id && block.id !== themeBlock.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Eyebrow<input value={themeBlock.eyebrow} onChange={(event) => setThemeBlock({ ...themeBlock, eyebrow: event.target.value })} /></label><label>Display order<input min="0" type="number" value={themeBlock.displayOrder} onChange={(event) => setThemeBlock({ ...themeBlock, displayOrder: Number(event.target.value) })} /></label><label className="product-form__full">Headline<input value={themeBlock.headline} onChange={(event) => setThemeBlock({ ...themeBlock, headline: event.target.value })} /></label><label className="product-form__full">Description<textarea value={themeBlock.description} onChange={(event) => setThemeBlock({ ...themeBlock, description: event.target.value })} /></label><ImageUpload label="Homepage theme image" previewSrc={publicAssetUrl('site-assets', themeBlock.imagePath)} onRemove={() => { setThemeBlock({ ...themeBlock, imagePath: null }); setThemeBlockFile(null); }} onSelect={setThemeBlockFile} /><label className="product-form__toggle"><input checked={themeBlock.isActive} type="checkbox" onChange={(event) => setThemeBlock({ ...themeBlock, isActive: event.target.checked })} />Visible on public website</label><button className="button" type="submit">Save homepage theme block</button></form></AdminModal>}</section>
    <section className="admin-content-card"><div className="admin-toolbar"><div><p className="eyebrow">Products</p><h2>Style ranges</h2></div><button className="button" onClick={() => setRange(blankRange())} type="button">Add range</button></div><div className="admin-list">{ranges.map((item) => <article key={item.id}><div><b>{item.name}</b><p>{item.isActive ? 'Visible' : 'Hidden'}</p></div><div aria-label={`${item.name} actions`} className="admin-action-group" role="group"><button className="admin-text-button" onClick={() => setPaletteRange(item)} type="button">Manage palette</button><button className="admin-text-button" onClick={() => setRange(item)} type="button">Edit</button><button className="admin-text-button" onClick={() => void setStyleRangeActive(item.id, !item.isActive).then(load)} type="button">{item.isActive ? 'Hide' : 'Show'}</button></div></article>)}</div>{range && <AdminModal label={range.id ? `Edit ${range.name}` : 'Add range'} onClose={() => setRange(null)}><form className="product-form" onSubmit={(event) => void saveRange(event)}><div className="product-form__heading"><h2>{range.id ? 'Edit range' : 'Add range'}</h2><button className="admin-text-button" onClick={() => setRange(null)} type="button">Close</button></div><label>Name<input value={range.name} onChange={(event) => setRange({ ...range, name: event.target.value, slug: slugify(event.target.value) })} /></label><label>URL slug<input readOnly value={range.slug} /></label><label>Eyebrow<input value={range.eyebrow} onChange={(event) => setRange({ ...range, eyebrow: event.target.value })} /></label><label>Display order<input min="0" type="number" value={range.displayOrder} onChange={(event) => setRange({ ...range, displayOrder: Number(event.target.value) })} /></label><label className="product-form__full">Headline<input value={range.headline} onChange={(event) => setRange({ ...range, headline: event.target.value })} /></label><label className="product-form__full">Description<textarea value={range.description} onChange={(event) => setRange({ ...range, description: event.target.value })} /></label><ImageUpload label="Range hero" previewSrc={publicAssetUrl('site-assets', range.heroImagePath)} onRemove={() => { setRange({ ...range, heroImagePath: null }); setRangeHeroFile(null); }} onSelect={setRangeHeroFile} /><ImageUpload label="Range interior" previewSrc={publicAssetUrl('site-assets', range.roomImagePath)} onRemove={() => { setRange({ ...range, roomImagePath: null }); setRangeRoomFile(null); }} onSelect={setRangeRoomFile} /><label className="product-form__toggle"><input checked={range.isActive} type="checkbox" onChange={(event) => setRange({ ...range, isActive: event.target.checked })} />Visible on public website</label><button className="button" type="submit">Save range</button></form></AdminModal>}{paletteRange && <PaletteManager onChanged={() => { void load(); }} onClose={() => setPaletteRange(null)} range={paletteRange} />}</section>
    <section className="admin-content-card"><p className="eyebrow">One-time setup</p><h2>Existing sample content</h2><p>Synchronise the current IKKO imagery, product catalogue, projects and media articles to the cloud. Existing records are left unchanged.</p><button className="button" disabled={importing} onClick={() => void runImport()} type="button">{importing ? 'Importing…' : 'Import existing sample content'}</button></section>
  </section>;
}
