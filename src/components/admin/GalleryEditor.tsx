import { useState } from 'react';
export type GalleryImage = { id: string; path: string; sortOrder: number; file?: File; previewSrc?: string };
export function normaliseGalleryOrder(images: GalleryImage[]) { return [...images].sort((a, b) => a.sortOrder - b.sortOrder).map((image, sortOrder) => ({ ...image, sortOrder })); }
export function GalleryEditor({ images, onChange, previewForPath = (path: string) => path }: { images: GalleryImage[]; onChange: (images: GalleryImage[]) => void; previewForPath?: (path: string) => string }) {
  const [error, setError] = useState(''); const ordered = normaliseGalleryOrder(images);
  const move = (index: number, direction: -1 | 1) => { const next = [...ordered]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(normaliseGalleryOrder(next)); };
  const add = (files: FileList | null) => {
    const selected = Array.from(files ?? []); if (!selected.length) return;
    const invalid = selected.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) { setError('Use JPG, PNG or WebP images under 10 MB.'); return; }
    setError(''); onChange([...ordered, ...selected.map((file, index) => ({ id: crypto.randomUUID(), path: '', file, previewSrc: URL.createObjectURL(file), sortOrder: ordered.length + index }))]);
  };
  const remove = (image: GalleryImage) => { if (image.previewSrc?.startsWith('blob:')) URL.revokeObjectURL(image.previewSrc); onChange(ordered.filter(({ id }) => id !== image.id)); };
  return <section className="gallery-editor"><div className="gallery-editor__add"><label>Add gallery images<input accept="image/jpeg,image/png,image/webp" aria-label="Add gallery images" multiple onChange={(event) => add(event.target.files)} type="file" /><small>Images are optimised below 1 MB on upload.</small></label></div>{error && <p className="error" role="alert">{error}</p>}{!ordered.length && <p>No gallery images yet.</p>}{ordered.map((image, index) => <div className="gallery-editor__row" key={image.id}><span>{index + 1}</span><img alt={`Gallery image ${index + 1} preview`} src={image.previewSrc ?? previewForPath(image.path)} /><code>{image.file?.name ?? image.path}</code><button aria-label={`Move image ${index + 1} earlier`} className="admin-text-button" disabled={index === 0} onClick={() => move(index, -1)} type="button">↑</button><button aria-label={`Move image ${index + 1} later`} className="admin-text-button" disabled={index === ordered.length - 1} onClick={() => move(index, 1)} type="button">↓</button><button aria-label={`Remove image ${index + 1}`} className="admin-text-button" onClick={() => remove(image)} type="button">Remove</button></div>)}</section>;
}
