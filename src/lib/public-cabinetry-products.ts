import { getSupabaseClient, hasSupabaseConfiguration } from './supabase';
import { normaliseProductDetailContent, type ProductDetailContent } from '../types/product-detail-content';

type StyleRangeLink = { id: string; slug: string; name: string; is_active: boolean };

export type CabinetryProductRow = {
  id: string;
  eyebrow: string;
  headline: string;
  description: string;
  detail_content?: unknown;
  scope: string;
  hero_image_path: string | null;
  style_ranges: StyleRangeLink | StyleRangeLink[];
  cabinetry_product_images?: Array<{ id: string; image_path: string; display_order: number; is_active: boolean }>;
};

export type PublicCabinetryProduct = {
  id: string;
  rangeId: string;
  rangeSlug: string;
  rangeName: string;
  name: string;
  eyebrow: string;
  description: string;
  detailContent: ProductDetailContent;
  scope: string;
  heroImageUrl: string | null;
  galleryImageUrls: string[];
};

function assetUrl(path: string | null) {
  return path ? getSupabaseClient().storage.from('site-assets').getPublicUrl(path).data.publicUrl : null;
}

function oneRange(value: StyleRangeLink | StyleRangeLink[]): StyleRangeLink {
  return Array.isArray(value) ? value[0] : value;
}

export function mapPublicCabinetryProductRow(row: CabinetryProductRow, urlForPath: (path: string | null) => string | null = assetUrl): PublicCabinetryProduct {
  const range = oneRange(row.style_ranges);
  const gallery = [...(row.cabinetry_product_images ?? [])]
    .filter((image) => image.is_active)
    .sort((left, right) => left.display_order - right.display_order)
    .map((image) => urlForPath(image.image_path))
    .filter((image): image is string => Boolean(image));
  return {
    id: row.id,
    rangeId: range.id,
    rangeSlug: range.slug,
    rangeName: range.name,
    name: row.headline,
    eyebrow: row.eyebrow,
    description: row.description,
    detailContent: normaliseProductDetailContent(row.detail_content),
    scope: row.scope,
    heroImageUrl: urlForPath(row.hero_image_path),
    galleryImageUrls: gallery,
  };
}

const selectFields = 'id, eyebrow, headline, description, detail_content, scope, hero_image_path, is_active, style_ranges!inner(id, slug, name, is_active), cabinetry_product_images(id, image_path, display_order, is_active)';

export async function getPublicCabinetryProductByRangeSlug(slug: string): Promise<PublicCabinetryProduct | null> {
  if (!hasSupabaseConfiguration()) return null;
  const { data, error } = await getSupabaseClient().from('cabinetry_products').select(selectFields)
    .eq('style_ranges.slug', slug).eq('style_ranges.is_active', true).eq('is_active', true).maybeSingle();
  if (error) throw new Error('Unable to load cabinetry product.');
  return data ? mapPublicCabinetryProductRow(data as unknown as CabinetryProductRow) : null;
}
