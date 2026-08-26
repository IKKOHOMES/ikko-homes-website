import { getSupabaseClient, hasSupabaseConfiguration } from './supabase';

type HomeRow = {
  hero_eyebrow: string;
  hero_heading: string;
  hero_cta_label: string;
  hero_cta_path: string;
  hero_image_path: string | null;
};

type ServiceRow = { id: string; title: string; description: string; icon_key: 'consultation' | 'joinery' | 'furniture' | 'delivery'; display_order: number; is_active: boolean };

export type PublicHomeContent = {
  heroEyebrow: string;
  heroHeading: string;
  heroCtaLabel: string;
  heroCtaPath: string;
  heroImageUrl: string | null;
};

export type PublicServicePillar = { id: string; title: string; description: string; iconKey: ServiceRow['icon_key']; displayOrder: number };

function assetUrl(path: string | null) {
  return path ? getSupabaseClient().storage.from('site-assets').getPublicUrl(path).data.publicUrl : null;
}

export function mapPublicHomeContentRow(row: HomeRow, urlForPath: (path: string | null) => string | null = assetUrl): PublicHomeContent {
  return { heroEyebrow: row.hero_eyebrow, heroHeading: row.hero_heading, heroCtaLabel: row.hero_cta_label, heroCtaPath: row.hero_cta_path, heroImageUrl: urlForPath(row.hero_image_path) };
}

export function mapPublicServicePillarRow(row: ServiceRow): PublicServicePillar {
  return { id: row.id, title: row.title, description: row.description, iconKey: row.icon_key, displayOrder: row.display_order };
}

export async function listPublicHomeContent(): Promise<PublicHomeContent | null> {
  if (!hasSupabaseConfiguration()) return null;
  const { data, error } = await getSupabaseClient().from('home_page_content').select('hero_eyebrow, hero_heading, hero_cta_label, hero_cta_path, hero_image_path').eq('id', true).maybeSingle();
  if (error) throw new Error('Unable to load homepage content.');
  return data ? mapPublicHomeContentRow(data as HomeRow) : null;
}

export async function listPublicServicePillars(): Promise<PublicServicePillar[]> {
  if (!hasSupabaseConfiguration()) return [];
  const { data, error } = await getSupabaseClient().from('home_service_pillars').select('id, title, description, icon_key, display_order, is_active').eq('is_active', true).order('display_order');
  if (error) throw new Error('Unable to load homepage services.');
  return (data ?? []).map((row) => mapPublicServicePillarRow(row as ServiceRow));
}
