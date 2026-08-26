import { afterEach, expect, test, vi } from 'vitest';
import { compressPublicImage, MAX_PUBLIC_IMAGE_BYTES } from '../lib/image-compression';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('keeps an image below the public size limit unchanged', async () => {
  const source = new File([new Uint8Array(256)], 'material.png', { type: 'image/png' });

  const result = await compressPublicImage(source);

  expect(result).toBe(source);
});

test.each([
  ['living-room.png', 'image/png'],
  ['living-room.jpg', 'image/jpeg'],
])('keeps an oversized %s display image in its original format while reducing its size', async (name, type) => {
  const source = new File([new Uint8Array(MAX_PUBLIC_IMAGE_BYTES + 1)], name, { type });
  const drawImage = vi.fn();
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2000, height: 1200, close })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob([new Uint8Array(MAX_PUBLIC_IMAGE_BYTES - 1)], { type }));
  });

  const result = await compressPublicImage(source);

  expect(result.type).toBe(type);
  expect(result.name).toBe(name);
  expect(result.size).toBeLessThan(MAX_PUBLIC_IMAGE_BYTES);
  expect(drawImage).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});
