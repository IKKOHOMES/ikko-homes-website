import type { ProductDetailContent } from './product-detail-content';
import type { ProductColour } from './domain';

export type ProductCategory = 'seating' | 'tables' | 'lighting' | 'storage';

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  price: number;
  description: string;
  detailContent?: ProductDetailContent;
  imageTone: string;
  imageUrl?: string | null;
  galleryImageUrls?: string[];
  finishes: string[];
  colours?: ProductColour[];
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  location: string;
  style: string;
  imageTone: string;
  introduction: string;
  designFocus: string;
  galleryTones: [string, string];
}
