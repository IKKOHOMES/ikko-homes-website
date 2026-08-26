import { getSupabaseClient, hasSupabaseConfiguration } from './supabase';

type StyleRangeRow = {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  description: string;
  hero_image_path: string | null;
  room_image_path: string | null;
  palette: string[];
  style_range_palette_items?: Array<{ id: string; name: string; colour: string; image_path: string | null; display_order: number; is_active: boolean }>;
  display_order: number;
  is_active: boolean;
};

export type PublicPaletteItem = {
  id: string;
  name: string;
  colour: string;
  imageUrl: string | null;
  displayOrder: number;
};

export type PublicStyleRange = {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  description: string;
  heroImageUrl: string | null;
  roomImageUrl: string | null;
  palette: PublicPaletteItem[];
  displayOrder: number;
  isActive: boolean;
};

function assetUrl(path: string | null) {
  return path ? getSupabaseClient().storage.from('site-assets').getPublicUrl(path).data.publicUrl : null;
}

export function mapPublicStyleRangeRow(row: StyleRangeRow, urlForPath: (path: string | null) => string | null = assetUrl): PublicStyleRange {
  const palette = [...(row.style_range_palette_items ?? [])]
    .filter((item) => item.is_active)
    .sort((left, right) => left.display_order - right.display_order)
    .map((item) => ({ id: item.id, name: item.name, colour: item.colour, imageUrl: item.image_path ? urlForPath(item.image_path) : null, displayOrder: item.display_order }));
  return { id: row.id, slug: row.slug, name: row.name, eyebrow: row.eyebrow, headline: row.headline, description: row.description, heroImageUrl: row.hero_image_path ? urlForPath(row.hero_image_path) : null, roomImageUrl: row.room_image_path ? urlForPath(row.room_image_path) : null, palette, displayOrder: row.display_order, isActive: row.is_active };
}

export async function listPublicStyleRanges(): Promise<PublicStyleRange[]> {
  if (!hasSupabaseConfiguration()) return [];
  const { data, error } = await getSupabaseClient().from('style_ranges').select('id, slug, name, eyebrow, headline, description, hero_image_path, room_image_path, palette, display_order, is_active, style_range_palette_items(id, name, colour, image_path, display_order, is_active)').eq('is_active', true).order('display_order');
  if (error) throw new Error('Unable to load style ranges.');
  return (data ?? []).map((row) => mapPublicStyleRangeRow(row as StyleRangeRow));
}

export async function getPublicStyleRangeBySlug(slug: string): Promise<PublicStyleRange | null> {
  if (!hasSupabaseConfiguration()) return null;
  const { data, error } = await getSupabaseClient().from('style_ranges').select('id, slug, name, eyebrow, headline, description, hero_image_path, room_image_path, palette, display_order, is_active, style_range_palette_items(id, name, colour, image_path, display_order, is_active)').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (error) throw new Error('Unable to load style range.');
  return data ? mapPublicStyleRangeRow(data as StyleRangeRow) : null;
}
