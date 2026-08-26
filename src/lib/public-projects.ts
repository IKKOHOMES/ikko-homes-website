import { getSupabaseClient, hasSupabaseConfiguration } from './supabase';

type ProjectImageRow = { path: string; display_order: number };
export type PublicProjectRow = { id: string; slug: string; name: string; location: string; style: string; introduction: string; image_tone: string; cover_image_path: string | null; display_order: number; project_images?: ProjectImageRow[] };
export type PublicProject = { id: string; slug: string; name: string; location: string; style: string; introduction: string; imageTone: string; displayOrder: number; coverImageUrl: string | null; gallery: string[] };

export function mapPublicProjectRow(row: PublicProjectRow, imageUrl: (path: string) => string): PublicProject {
  return { id: row.id, slug: row.slug, name: row.name, location: row.location, style: row.style, introduction: row.introduction, imageTone: row.image_tone, displayOrder: row.display_order, coverImageUrl: row.cover_image_path ? imageUrl(row.cover_image_path) : null, gallery: [...(row.project_images ?? [])].sort((left, right) => left.display_order - right.display_order).map((image) => imageUrl(image.path)) };
}

function projectImageUrl(path: string): string { return getSupabaseClient().storage.from('project-assets').getPublicUrl(path).data.publicUrl; }

export async function listPublicProjects(): Promise<PublicProject[]> {
  if (!hasSupabaseConfiguration()) return [];
  const { data, error } = await getSupabaseClient().from('projects').select('id, slug, name, location, style, introduction, image_tone, cover_image_path, display_order, project_images(path, display_order)').eq('is_active', true).order('display_order').order('name');
  if (error) throw new Error('Unable to load public projects.');
  return ((data ?? []) as unknown as PublicProjectRow[]).map((project) => mapPublicProjectRow(project, projectImageUrl));
}

export async function getPublicProjectBySlug(slug: string): Promise<PublicProject | null> {
  if (!hasSupabaseConfiguration()) return null;
  const { data, error } = await getSupabaseClient().from('projects').select('id, slug, name, location, style, introduction, image_tone, cover_image_path, display_order, project_images(path, display_order)').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (error) throw new Error('Unable to load public project.');
  return data ? mapPublicProjectRow(data as unknown as PublicProjectRow, projectImageUrl) : null;
}
