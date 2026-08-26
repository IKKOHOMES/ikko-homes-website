export type SampleAsset = {
  bucket: 'site-assets';
  sourceUrl: string;
  destination: string;
  owner: 'home' | 'japanese-modern' | 'japandi' | 'organic-modern';
  field: 'hero_image_path' | 'room_image_path';
};

export type SampleRecords = {
  products: Array<{ id: string; slug: string; name: string; description: string; price: number; category: string; imageTone: string; finishes: string[]; themeSlugs: string[] }>;
  projects: Array<{ slug: string; name: string; location: string; style: string; introduction: string; imageTone: string }>;
  posts: Array<{ title: string; slug: string; excerpt: string; body: string; publicationDate: string }>;
};

/**
 * These imports only run from the protected content importer. The public
 * storefront never loads the local samples or uses them as a fallback.
 */
export async function loadExistingSampleAssets(): Promise<SampleAsset[]> {
  const [homeHero, japaneseModern, japandi, organicModern] = await Promise.all([
    import('../assets/ikko-home-hero.png'),
    import('../assets/ikko-japanese-modern.png'),
    import('../assets/ikko-japandi.png'),
    import('../assets/ikko-organic-modern.png'),
  ]);

  return [
    { bucket: 'site-assets', sourceUrl: homeHero.default, destination: 'home/hero.png', owner: 'home', field: 'hero_image_path' },
    { bucket: 'site-assets', sourceUrl: japaneseModern.default, destination: 'ranges/japanese-modern/hero.png', owner: 'japanese-modern', field: 'hero_image_path' },
    { bucket: 'site-assets', sourceUrl: japaneseModern.default, destination: 'ranges/japanese-modern/room.png', owner: 'japanese-modern', field: 'room_image_path' },
    { bucket: 'site-assets', sourceUrl: japandi.default, destination: 'ranges/japandi/hero.png', owner: 'japandi', field: 'hero_image_path' },
    { bucket: 'site-assets', sourceUrl: japandi.default, destination: 'ranges/japandi/room.png', owner: 'japandi', field: 'room_image_path' },
    { bucket: 'site-assets', sourceUrl: organicModern.default, destination: 'ranges/organic-modern/hero.png', owner: 'organic-modern', field: 'hero_image_path' },
    { bucket: 'site-assets', sourceUrl: organicModern.default, destination: 'ranges/organic-modern/room.png', owner: 'organic-modern', field: 'room_image_path' },
  ];
}

/** Existing sample records are only read by the protected one-time importer. */
export async function loadExistingSampleRecords(): Promise<SampleRecords> {
  const [{ products }, { projects }, { themes }] = await Promise.all([
    import('../data/catalog'),
    import('../data/projects'),
    import('../data/themes'),
  ]);

  const sharedThemeSlugs = ['japanese-modern', 'japandi', 'organic-modern'];
  const categorySamples = [
    { id: 'nagi-side-table', slug: 'nagi-side-table', name: 'Nagi Side Table', description: 'A compact oak side table with a softened, sculptural profile.', price: 420, category: 'tables', imageTone: 'table', finishes: ['Natural Oak', 'Walnut'], themeSlugs: sharedThemeSlugs },
    { id: 'hoku-dining-table', slug: 'hoku-dining-table', name: 'Hoku Dining Table', description: 'A generously proportioned dining table for everyday gathering.', price: 1690, category: 'tables', imageTone: 'table', finishes: ['Natural Oak', 'Smoked Oak'], themeSlugs: sharedThemeSlugs },
    { id: 'koto-dining-chair', slug: 'koto-dining-chair', name: 'Koto Dining Chair', description: 'A comfortable dining chair with a crafted timber frame and upholstered seat.', price: 430, category: 'seating', imageTone: 'chair', finishes: ['Oat Bouclé', 'Natural Oak'], themeSlugs: sharedThemeSlugs },
    { id: 'sora-platform-bed', slug: 'sora-platform-bed', name: 'Sora Platform Bed', description: 'A calm, low-profile platform bed designed for a softly layered bedroom.', price: 2290, category: 'seating', imageTone: 'sofa', finishes: ['Cloud Linen', 'Natural Oak'], themeSlugs: sharedThemeSlugs },
    { id: 'mizu-bedside-table', slug: 'mizu-bedside-table', name: 'Mizu Bedside Table', description: 'A small bedside table with considered storage and a warm oak finish.', price: 380, category: 'tables', imageTone: 'sideboard', finishes: ['Natural Oak', 'Walnut'], themeSlugs: sharedThemeSlugs },
  ];

  return {
    products: [...products.map(({ id, slug, name, description, price, category, imageTone, finishes }) => ({ id, slug, name, description, price, category, imageTone, finishes, themeSlugs: themes.filter((theme) => theme.productIds.includes(id)).map((theme) => theme.slug) })), ...categorySamples],
    projects: projects.map(({ slug, name, location, style, introduction, imageTone }) => ({ slug, name, location, style, introduction, imageTone })),
    posts: [
      { title: 'Design notes for a more considered home', slug: 'design-notes-considered-home', excerpt: 'Independent articles and studio stories.', body: 'Independent articles and studio stories from IKKO Homes.', publicationDate: '2026-08-21T00:00:00.000Z' },
      { title: 'Scenes from our studio and projects', slug: 'studio-and-project-scenes', excerpt: 'Visual updates from IKKO Homes.', body: 'Visual updates from our studio and projects.', publicationDate: '2026-08-20T00:00:00.000Z' },
      { title: 'News, conversations and new arrivals', slug: 'news-conversations-new-arrivals', excerpt: 'Community updates and announcements.', body: 'Community updates and announcements from IKKO Homes.', publicationDate: '2026-08-19T00:00:00.000Z' },
      { title: 'Living inspiration, shared in the moment', slug: 'living-inspiration-shared', excerpt: 'Synchronized posts for our Chinese-speaking community.', body: 'Living inspiration, shared in the moment.', publicationDate: '2026-08-18T00:00:00.000Z' },
    ],
  };
}
