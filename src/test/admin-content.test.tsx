import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { GalleryEditor, normaliseGalleryOrder, type GalleryImage } from '../components/admin/GalleryEditor';
import { ImageUpload } from '../components/admin/ImageUpload';
import { validateImageFile } from '../lib/admin-api';

test('assigns sequential display order after a project gallery reorder', () => {
  const ordered = normaliseGalleryOrder([
    { id: 'b', path: 'living.jpg', sortOrder: 5 },
    { id: 'a', path: 'kitchen.jpg', sortOrder: 1 },
  ]);

  expect(ordered).toEqual([
    { id: 'a', path: 'kitchen.jpg', sortOrder: 0 },
    { id: 'b', path: 'living.jpg', sortOrder: 1 },
  ]);
});

test('rejects unsupported or oversized image files before upload', () => {
  expect(validateImageFile(new File(['x'], 'notes.pdf', { type: 'application/pdf' }))).toBe('Use a JPG, PNG or WebP image.');
  expect(validateImageFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }))).toBe('Images must be under 10 MB.');
});

test('shows a saved image preview and lets the administrator remove it', async () => {
  const user = userEvent.setup(); const onRemove = vi.fn();
  render(<ImageUpload label="Project cover image" previewSrc="https://cdn.example/cover.jpg" onRemove={onRemove} onSelect={() => undefined} />);

  expect(screen.getByRole('img', { name: 'Project cover image preview' })).toHaveAttribute('src', 'https://cdn.example/cover.jpg');
  await user.click(screen.getByRole('button', { name: 'Remove Project cover image' }));
  expect(onRemove).toHaveBeenCalledOnce();
});

test('adds selected project gallery files in sequence with a preview', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:living', revokeObjectURL: () => undefined });
  function GalleryHarness() { const [images, setImages] = useState<GalleryImage[]>([]); return <GalleryEditor images={images} onChange={setImages} />; }
  render(<GalleryHarness />);

  await user.upload(screen.getByLabelText('Add gallery images'), new File(['image'], 'living.jpg', { type: 'image/jpeg' }));

  expect(screen.getByRole('img', { name: 'Gallery image 1 preview' })).toHaveAttribute('src', 'blob:living');
  vi.unstubAllGlobals();
});
