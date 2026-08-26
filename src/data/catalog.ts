import type { Product } from '../types/catalog';

export const products: Product[] = [
  {
    id: 'mori-lounge-chair', slug: 'mori-lounge-chair', name: 'Mori Lounge Chair', category: 'seating', price: 1290,
    description: 'Sculptural simplicity meets everyday comfort, with a solid oak frame and softly supportive cushions.',
    imageTone: 'chair', finishes: ['Natural Oak', 'Walnut'],
  },
  {
    id: 'haru-sofa', slug: 'haru-3-seater-sofa', name: 'Haru 3-Seater Sofa', category: 'seating', price: 1899,
    description: 'A generous sofa with balanced proportions, tactile upholstery and a quietly inviting profile.',
    imageTone: 'sofa', finishes: ['Oat Bouclé', 'Cloud Linen'],
  },
  {
    id: 'kumo-modular-sofa', slug: 'kumo-modular-sofa', name: 'Kumo Modular Sofa', category: 'seating', price: 2490,
    description: 'A flexible, low-profile sofa system with soft, generous cushions and relaxed proportions.',
    imageTone: 'sofa', finishes: ['Warm White', 'Mushroom Bouclé'],
  },
  {
    id: 'aoi-curved-sofa', slug: 'aoi-curved-sofa', name: 'Aoi Curved Sofa', category: 'seating', price: 2290,
    description: 'A sculpted curved sofa that brings a gentle, inviting silhouette to the living room.',
    imageTone: 'sofa', finishes: ['Oat Bouclé', 'Sand Linen'],
  },
  {
    id: 'sumi-2-seater-sofa', slug: 'sumi-2-seater-sofa', name: 'Sumi 2-Seater Sofa', category: 'seating', price: 1640,
    description: 'A compact two-seater with softly rounded arms, tailored for smaller spaces.',
    imageTone: 'sofa', finishes: ['Cloud Linen', 'Natural Wool'],
  },
  {
    id: 'nori-low-sofa', slug: 'nori-low-sofa', name: 'Nori Low Sofa', category: 'seating', price: 2190,
    description: 'A grounded, deep-seat sofa with a low silhouette and a calm, contemporary profile.',
    imageTone: 'sofa', finishes: ['Warm White', 'Oat Bouclé'],
  },
  {
    id: 'kiri-daybed', slug: 'kiri-daybed', name: 'Kiri Daybed', category: 'seating', price: 1490,
    description: 'A versatile oak-framed daybed for quiet reading corners and relaxed afternoon lounging.',
    imageTone: 'sofa', finishes: ['Natural Oak', 'Cloud Linen'],
  },
  {
    id: 'ryo-table', slug: 'ryo-round-coffee-table', name: 'Ryo Round Coffee Table', category: 'tables', price: 699,
    description: 'Rounded oak forms that bring a grounded, relaxed rhythm to the living room.',
    imageTone: 'table', finishes: ['Natural Oak', 'Smoked Oak'],
  },
  {
    id: 'nami-light', slug: 'nami-pendant-light', name: 'Nami Pendant Light', category: 'lighting', price: 249,
    description: 'A softly pleated pendant designed to bring warm, ambient light to everyday spaces.',
    imageTone: 'pendant', finishes: ['Warm White', 'Natural Rattan'],
  },
  {
    id: 'kumo-floor-lamp', slug: 'kumo-floor-lamp', name: 'Kumo Floor Lamp', category: 'lighting', price: 590,
    description: 'A slender oak floor lamp with a softly diffused linen shade for quiet pools of light.',
    imageTone: 'pendant', finishes: ['Natural Oak', 'Warm White'],
  },
  {
    id: 'aki-wall-sconce', slug: 'aki-wall-sconce', name: 'Aki Wall Sconce', category: 'lighting', price: 329,
    description: 'A compact ceramic wall light with a gentle upward glow and a restrained profile.',
    imageTone: 'pendant', finishes: ['Chalk', 'Sandstone'],
  },
  {
    id: 'ren-table-lamp', slug: 'ren-table-lamp', name: 'Ren Table Lamp', category: 'lighting', price: 395,
    description: 'A hand-finished table lamp that brings texture and warmth to shelves, desks and bedsides.',
    imageTone: 'pendant', finishes: ['Oat Linen', 'Walnut'],
  },
  {
    id: 'sora-sideboard', slug: 'sora-sideboard', name: 'Sora Sideboard', category: 'storage', price: 1499,
    description: 'Low oak storage with calm proportions and beautifully restrained detailing.',
    imageTone: 'sideboard', finishes: ['Natural Oak', 'Walnut'],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
