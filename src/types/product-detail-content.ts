export const productDetailKeys = ['description', 'details', 'dimensions', 'care'] as const;

export type ProductDetailKey = (typeof productDetailKeys)[number];

export const productDetailLabels: Record<ProductDetailKey, string> = {
  description: 'Description',
  details: 'Details',
  dimensions: 'Dimensions',
  care: 'Care & Maintenance',
};

export type ProductDetailSection = {
  body: string;
  bullets: string[];
};

export type ProductDetailContent = Record<ProductDetailKey, ProductDetailSection>;

export function emptyProductDetailContent(): ProductDetailContent {
  return {
    description: { body: '', bullets: [] },
    details: { body: '', bullets: [] },
    dimensions: { body: '', bullets: [] },
    care: { body: '', bullets: [] },
  };
}

export function normaliseProductDetailContent(value: unknown): ProductDetailContent {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const content = emptyProductDetailContent();
  for (const key of productDetailKeys) {
    const section = source[key];
    if (!section || typeof section !== 'object') continue;
    const candidate = section as Record<string, unknown>;
    content[key] = {
      body: typeof candidate.body === 'string' ? candidate.body : '',
      bullets: Array.isArray(candidate.bullets) ? candidate.bullets.filter((item): item is string => typeof item === 'string') : [],
    };
  }
  return content;
}

export function fallbackProductDetailContent(productName: string, isCabinetry: boolean): ProductDetailContent {
  return isCabinetry
    ? {
      description: { body: 'Every IKKO cabinetry project is shaped around the way you live. Upload a drawing to begin the review, then our joinery team will confirm a considered specification and quotation.\n\nKitchen, wardrobe, laundry and living-room cabinetry can all be scoped from your plans.', bullets: ['Crafted from made-to-measure joinery', 'Designed for Australian homes', 'Thoughtful material selections', 'Care guidance included'] },
      details: { body: 'Your drawing is reviewed by our joinery team before we prepare an itemised scope.', bullets: ['Made with considered craftsmanship', 'Finish selection confirmed before production', 'Care instructions supplied on delivery'] },
      dimensions: { body: 'Dimensions are confirmed from the approved drawing set and final site measure.', bullets: ['Custom to your project', 'Allow for access and installation clearances'] },
      care: { body: 'Care requirements are confirmed with your final joinery specification.', bullets: ['Care guidance supplied on handover', 'Use suitable cleaning products'] },
    }
    : {
      description: { body: `${productName} brings together organic form and refined craftsmanship. Its calm proportions, warm materials and considered detailing make it an easy part of everyday living.\n\nDesigned for reading nooks, living rooms and hospitality spaces that call for quiet warmth.`, bullets: ['Crafted from solid oak and tactile upholstery', 'Designed for Australian homes', 'Thoughtful material selections', 'Care guidance included'] },
      details: { body: 'Built for daily use with carefully selected, long-lasting materials and a refined finish.', bullets: ['Made with considered craftsmanship', 'Finish selection confirmed before production', 'Care instructions supplied on delivery'] },
      dimensions: { body: 'Refer to the product specification supplied with your order for complete dimensions.', bullets: ['Proportioned for everyday comfort', 'Allow for access and installation clearances'] },
      care: { body: 'Follow the care instructions supplied with your product to protect its finish and materials.', bullets: ['Clean with a soft, dry cloth', 'Avoid direct sunlight and harsh chemicals'] },
    };
}
