import { getSupabaseClient, hasSupabaseConfiguration } from './supabase';

type HomeThemeBlockRow = {
  id: string;
  style_range_id: string;
  eyebrow: string;
  headline: string;
  description: string;
  image_path: string | null;
  display_order: number;
  is_active: boolean;
  style_ranges: { slug: string; name: string } | Array<{ slug: string; name: string }>;
};

export type PublicHomeThemeBlock = {
  id: string;
  rangeSlug: string;
  rangeName: string;
  eyebrow: string;
  headline: string;
  description: string;
  imageUrl: string | null;
  displayOrder: number;
};

function assetUrl(path: string | null) {
  return path ? getSupabaseClient().storage.from('site-assets').getPublicUrl(path).data.publicUrl : null;
}

export function mapPublicHomeThemeBlockRow(row: HomeThemeBlockRow, urlForPath: (path: string | null) => string | null = assetUrl): PublicHomeThemeBlock {
  const range = Array.isArray(row.style_ranges) ? row.style_ranges[0] : row.style_ranges;
  return {
    id: row.id,
    rangeSlug: range.slug,
    rangeName: range.name,
    eyebrow: row.eyebrow,
    headline: row.headline,
    description: row.description,
    imageUrl: urlForPath(row.image_path),
    displayOrder: row.display_order,
  };
}

export async function listPublicHomeThemeBlocks(): Promise<PublicHomeThemeBlock[]> {
  if (!hasSupabaseConfiguration()) return [];
  const { data, error } = await getSupabaseClient()
    .from('home_theme_blocks')
    .select('id, style_range_id, eyebrow, headline, description, image_path, display_order, is_active, style_ranges!inner(slug, name)')
    .eq('is_active', true)
    .order('display_order');
  if (error) throw new Error('Unable to load homepage theme blocks.');
  return (data ?? []).map((row) => mapPublicHomeThemeBlockRow(row as HomeThemeBlockRow));
}
