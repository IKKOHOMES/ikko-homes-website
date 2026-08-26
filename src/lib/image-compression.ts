export const MAX_PUBLIC_IMAGE_BYTES = 1_000_000;

function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to optimise this image.'));
    }, type, quality);
  });
}

export async function compressPublicImage(file: File): Promise<File> {
  if (file.size < MAX_PUBLIC_IMAGE_BYTES) return file;
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    throw new Error('Images over 1 MB must be uploaded as JPG or PNG.');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot optimise images. Please upload an image below 1 MB.');
  }

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.92;
  let best: File | null = null;

  try {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to optimise this image.');
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, file.type, quality);
      const candidate = new File([blob], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
      best = candidate;
      if (candidate.size < MAX_PUBLIC_IMAGE_BYTES) return candidate;

      if (quality > 0.68) {
        quality = Math.max(0.68, quality - 0.06);
      } else {
        width = Math.max(256, Math.round(width * 0.82));
        height = Math.max(256, Math.round(height * 0.82));
        quality = 0.9;
      }
    }
  } finally {
    bitmap.close?.();
  }

  if (best && best.size < MAX_PUBLIC_IMAGE_BYTES) return best;
  throw new Error('Unable to optimise this image below 1 MB. Please use a smaller image.');
}
