import { FormEvent, useCallback, useEffect, useState } from 'react';
import { deleteManagedPaletteItem, listManagedPaletteItems, publicAssetUrl, saveManagedPaletteItem, setPaletteItemActive, uploadSiteImage } from '../../lib/admin-api';
import type { PaletteItemSaveInput } from '../../lib/admin-api';
import type { ManagedPaletteItem } from '../../types/domain';
import { AdminModal } from './AdminModal';
import { ImageUpload } from './ImageUpload';

type PaletteManagerProps = {
  range: { id: string; name: string };
  onClose: () => void;
  onChanged: () => void;
};

type PaletteDraft = PaletteItemSaveInput;

function blankPaletteItem(styleRangeId: string, displayOrder: number): PaletteDraft {
  return { styleRangeId, name: '', colour: '#D9D6D0', imagePath: null, displayOrder, isActive: true };
}

export function PaletteManager({ onChanged, onClose, range }: PaletteManagerProps) {
  const [items, setItems] = useState<ManagedPaletteItem[]>([]);
  const [item, setItem] = useState<PaletteDraft | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listManagedPaletteItems(range.id));
      setMessage('');
    } catch {
      setMessage('Unable to load palette items.');
    } finally {
      setLoading(false);
    }
  }, [range.id]);

  useEffect(() => { void load(); }, [load]);

  function editPaletteItem(existing: ManagedPaletteItem) {
    setItem({ id: existing.id, styleRangeId: existing.styleRangeId, name: existing.name, colour: existing.colour, imagePath: existing.imagePath, displayOrder: existing.displayOrder, isActive: existing.isActive });
    setImageFile(null);
    setMessage('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    try {
      let imagePath = item.imagePath;
      if (imageFile) imagePath = await uploadSiteImage(`ranges/${range.id}/palette`, imageFile);
      await saveManagedPaletteItem({ ...item, imagePath });
      setItem(null);
      setImageFile(null);
      await load();
      onChanged();
      setMessage('Palette item saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save palette item.');
    }
  }

  async function toggleVisible(existing: ManagedPaletteItem) {
    try {
      await setPaletteItemActive(existing.id, !existing.isActive);
      await load();
      onChanged();
    } catch {
      setMessage('Unable to update palette item.');
    }
  }

  async function move(existing: ManagedPaletteItem, direction: -1 | 1) {
    const index = items.findIndex((candidate) => candidate.id === existing.id);
    const adjacent = items[index + direction];
    if (!adjacent) return;
    try {
      await Promise.all([
        saveManagedPaletteItem({ ...existing, displayOrder: adjacent.displayOrder }),
        saveManagedPaletteItem({ ...adjacent, displayOrder: existing.displayOrder }),
      ]);
      await load();
      onChanged();
    } catch {
      setMessage('Unable to reorder palette items.');
    }
  }

  async function remove(existing: ManagedPaletteItem) {
    if (!window.confirm(`Delete ${existing.name} from this palette?`)) return;
    try {
      await deleteManagedPaletteItem(existing.id);
      await load();
      onChanged();
      setMessage('Palette item deleted.');
    } catch {
      setMessage('Unable to delete palette item.');
    }
  }

  const nextDisplayOrder = Math.max(0, ...items.map((existing) => existing.displayOrder)) + 1;

  return <AdminModal label={`Manage ${range.name} palette`} onClose={onClose}>
    <section className="palette-manager">
      <div className="product-form__heading"><div><p className="eyebrow">Style range</p><h2>{range.name} palette</h2></div><button className="button" onClick={() => { setItem(blankPaletteItem(range.id, nextDisplayOrder)); setImageFile(null); }} type="button">Add palette item</button></div>
      {message && <p className="admin-notice" role="status">{message}</p>}
      {loading ? <p>Loading palette…</p> : <div className="palette-manager__list">{items.length ? items.map((existing, index) => { const imageUrl = publicAssetUrl('site-assets', existing.imagePath); return <article key={existing.id}><span aria-label={`${existing.name} preview`} className="palette-manager__swatch" style={imageUrl ? { backgroundColor: existing.colour, backgroundImage: `url(${imageUrl})` } : { backgroundColor: existing.colour }} /><div><b>{existing.name}</b><p>{existing.colour} · {existing.isActive ? 'Visible' : 'Hidden'}</p></div><div className="palette-manager__actions"><button aria-label={`Move ${existing.name} up`} className="admin-text-button" disabled={index === 0} onClick={() => void move(existing, -1)} type="button">↑</button><button aria-label={`Move ${existing.name} down`} className="admin-text-button" disabled={index === items.length - 1} onClick={() => void move(existing, 1)} type="button">↓</button><button className="admin-text-button" onClick={() => editPaletteItem(existing)} type="button">Edit</button><button className="admin-text-button" onClick={() => void toggleVisible(existing)} type="button">{existing.isActive ? 'Hide' : 'Show'}</button><button className="admin-text-button admin-text-button--danger" onClick={() => void remove(existing)} type="button">Delete</button></div></article>; }) : <p>No palette items yet. Add the first material to this range.</p>}</div>}
      {item && <form className="product-form palette-manager__editor" onSubmit={(event) => void save(event)}><div className="product-form__heading"><h3>{item.id ? `Edit ${item.name}` : 'Add palette item'}</h3><button className="admin-text-button" onClick={() => { setItem(null); setImageFile(null); }} type="button">Close editor</button></div><label>Name<input autoFocus onChange={(event) => setItem({ ...item, name: event.target.value })} required value={item.name} /></label><label>Fallback colour<input onChange={(event) => setItem({ ...item, colour: event.target.value })} pattern="#[0-9A-Fa-f]{6}" required value={item.colour} /></label><label>Display order<input min="0" onChange={(event) => setItem({ ...item, displayOrder: Number(event.target.value) })} type="number" value={item.displayOrder} /></label><ImageUpload label="Material image" previewSrc={publicAssetUrl('site-assets', item.imagePath)} onRemove={() => { setItem({ ...item, imagePath: null }); setImageFile(null); }} onSelect={setImageFile} /><label className="product-form__toggle"><input checked={item.isActive} onChange={(event) => setItem({ ...item, isActive: event.target.checked })} type="checkbox" />Visible on public website</label><button className="button" type="submit">Save palette item</button></form>}
    </section>
  </AdminModal>;
}
