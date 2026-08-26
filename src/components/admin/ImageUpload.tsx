import { useEffect, useState } from 'react';

type ImageUploadProps = {
  label: string;
  previewSrc?: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
};

export function ImageUpload({ label, previewSrc, onRemove, onSelect }: ImageUploadProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const imageSource = localPreview ?? previewSrc;

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  function select(file?: File) {
    if (!file) return;
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    onSelect(file);
  }

  function remove() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    onRemove();
  }

  return <div className="image-upload">
    <label>{label}<input accept="image/jpeg,image/png,image/webp" aria-label={`Upload ${label}`} onChange={(event) => select(event.target.files?.[0])} type="file" /><small>JPG, PNG or WebP · source up to 10 MB · uploads are optimised below 1 MB</small></label>
    {imageSource && <div className="image-upload__preview"><img alt={`${label} preview`} src={imageSource} /><button aria-label={`Remove ${label}`} className="admin-text-button" onClick={remove} type="button">Remove image</button></div>}
  </div>;
}
