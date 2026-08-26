import { expect, test } from 'vitest';
import { mapPublicProductRow } from '../lib/public-content';
import { filterPublishedPosts, mapPublicBlogRow, type PublicBlogRow } from '../lib/public-blogs';
test('maps active product data for the public catalogue',()=>{expect(mapPublicProductRow({id:'p1',slug:'mori',name:'Mori',description:'Chair',price:1290,category:'seating',category_id:'sofa-id',theme_slugs:['japanese-modern'],display_order:2,image_tone:'chair',image_path:null,product_images:[],product_finishes:[{name:'Oak'}]})).toMatchObject({id:'p1',slug:'mori',price:1290,finishes:['Oak'],categoryId:'sofa-id',themeSlugs:['japanese-modern'],displayOrder:2,isActive:true,imageTone:'chair',imageUrl:null,galleryImageUrls:[]});});

test('excludes draft and future-dated articles from the public media list', () => {
  const posts = filterPublishedPosts([
    { id: 'published', title: 'A quiet kitchen', slug: 'quiet-kitchen', excerpt: 'A story.', cover_image_path: null, publication_date: '2026-08-01T00:00:00.000Z', status: 'published', post_type: 'journal', destination_url: null },
    { id: 'future', title: 'Future note', slug: 'future-note', excerpt: 'A story.', cover_image_path: null, publication_date: '2026-09-01T00:00:00.000Z', status: 'published', post_type: 'journal', destination_url: null },
    { id: 'draft', title: 'Unpublished note', slug: 'draft-note', excerpt: 'A story.', cover_image_path: null, publication_date: '2026-08-01T00:00:00.000Z', status: 'draft', post_type: 'journal', destination_url: null },
  ], new Date('2026-08-21T00:00:00.000Z'));

  expect(posts.map((post) => post.slug)).toEqual(['quiet-kitchen']);
});

test('maps a published media post type and destination URL for its public card', () => {
  const post = mapPublicBlogRow({
    id: 'post-1', title: 'Quiet kitchen', slug: 'quiet-kitchen', excerpt: 'A story.', cover_image_path: null,
    publication_date: '2026-08-01T00:00:00.000Z', status: 'published', post_type: 'instagram', destination_url: 'https://instagram.com/p/quiet-kitchen',
  } as unknown as PublicBlogRow, (path) => `https://cdn.example/${path}`);

  expect(post).toMatchObject({ postType: 'instagram', destinationUrl: 'https://instagram.com/p/quiet-kitchen' });
});
