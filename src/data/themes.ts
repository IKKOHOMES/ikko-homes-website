export type ThemeSlug = 'japanese-modern' | 'japandi' | 'organic-modern';

export interface Theme {
  slug: ThemeSlug;
  name: string;
  eyebrow: string;
  headline: string;
  description: string;
  palette: string[];
  productIds: string[];
}

export const themes: Theme[] = [
  { slug: 'japanese-modern', name: 'Japanese Modern', eyebrow: 'Japanese Modern', headline: 'Quietly considered living.', description: 'Clean lines, natural materials and thoughtful details create calm, balanced spaces for everyday life.', palette: ['#d9d6d0', '#b78b5d', '#e5d4be', '#c9c7c3', '#dfd9d1'], productIds: ['mori-lounge-chair', 'nami-light', 'aki-wall-sconce'] },
  { slug: 'japandi', name: 'Japandi', eyebrow: 'Japandi', headline: 'Warmth in every detail.', description: 'Scandinavian simplicity meets Japanese craftsmanship to create spaces that feel warm, calm and timeless.', palette: ['#e1ddd4', '#bd8753', '#e8ded1', '#d7d4cf', '#d6cec1'], productIds: ['mori-lounge-chair', 'ryo-table', 'sora-sideboard', 'nami-light', 'ren-table-lamp'] },
  { slug: 'organic-modern', name: 'Organic Modern', eyebrow: 'Organic Modern', headline: 'Soft forms. Natural ease.', description: 'Sculptural silhouettes, tactile materials and organic textures come together to create spaces that feel grounded and inviting.', palette: ['#cdbda8', '#b58c6a', '#e9e0d6', '#c7c3b9', '#ded4c9'], productIds: ['haru-sofa', 'ryo-table', 'nami-light', 'kumo-floor-lamp', 'aki-wall-sconce'] },
];

export function getThemeBySlug(slug: string): Theme | undefined { return themes.find((theme) => theme.slug === slug); }
