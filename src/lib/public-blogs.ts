import { getSupabaseClient, hasSupabaseConfiguration } from './supabase';

export type PublicBlogRow = { id: string; title: string; slug: string; excerpt: string; cover_image_path: string | null; publication_date: string; status: 'draft' | 'published' | 'archived'; post_type: 'journal' | 'rednote' | 'facebook' | 'youtube' | 'instagram'; destination_url: string | null };
export type PublicBlogPost = { id: string; title: string; slug: string; excerpt: string; coverImageUrl: string | null; publicationDate: string; postType: PublicBlogRow['post_type']; destinationUrl: string | null };

export function filterPublishedPosts<T extends PublicBlogRow>(posts: T[], now = new Date()): T[] {
  return posts.filter((post) => post.status === 'published' && new Date(post.publication_date) <= now);
}

export function mapPublicBlogRow(row: PublicBlogRow, imageUrl: (path: string) => string): PublicBlogPost {
  return { id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt, coverImageUrl: row.cover_image_path ? imageUrl(row.cover_image_path) : null, publicationDate: row.publication_date, postType: row.post_type, destinationUrl: row.destination_url };
}

function blogImageUrl(path: string): string { return getSupabaseClient().storage.from('blog-assets').getPublicUrl(path).data.publicUrl; }

export async function listPublishedBlogPosts(): Promise<PublicBlogPost[]> {
  if (!hasSupabaseConfiguration()) return [];
  const { data, error } = await getSupabaseClient().from('blog_posts').select('id, title, slug, excerpt, cover_image_path, publication_date, status, post_type, destination_url').eq('status', 'published').lte('publication_date', new Date().toISOString()).order('publication_date', { ascending: false });
  if (error) throw new Error('Unable to load public blog posts.');
  return filterPublishedPosts((data ?? []) as PublicBlogRow[]).map((post) => mapPublicBlogRow(post, blogImageUrl));
}
