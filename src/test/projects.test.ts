import { expect, test } from 'vitest';
import { getProjectBySlug, projects } from '../data/projects';
import { mapPublicProjectRow } from '../lib/public-projects';

test('finds a complete project record from its public detail slug', () => {
  expect(getProjectBySlug('bondi-residence')).toMatchObject({
    name: 'Bondi Residence',
    location: 'Sydney, NSW',
    slug: 'bondi-residence',
  });
  expect(projects).toHaveLength(4);
  expect(getProjectBySlug('bondi-residence')?.galleryTones).toHaveLength(2);
});

test('maps an active project gallery in display order to public image URLs', () => {
  const project = mapPublicProjectRow({
    id: 'project-1', slug: 'bondi-residence', name: 'Bondi Residence', location: 'Sydney, NSW', style: 'Japandi', introduction: 'Calm spaces.', image_tone: 'bondi', cover_image_path: 'cover.jpg', display_order: 1,
    project_images: [{ path: 'living.jpg', display_order: 2 }, { path: 'kitchen.jpg', display_order: 1 }],
  }, (path) => `https://cdn.example/project/${path}`);

  expect(project).toMatchObject({ slug: 'bondi-residence', imageTone: 'bondi', coverImageUrl: 'https://cdn.example/project/cover.jpg', gallery: ['https://cdn.example/project/kitchen.jpg', 'https://cdn.example/project/living.jpg'] });
});
