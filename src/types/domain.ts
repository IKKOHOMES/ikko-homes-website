import type { ProductDetailContent } from './product-detail-content';

export type OrderStatus = 'new' | 'reviewing' | 'quoted' | 'invoiced' | 'completed';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';
export type PaymentInstalmentStatus = 'draft' | 'issued' | 'paid' | 'overdue';
export type BlogStatus = 'draft' | 'published' | 'archived';
export type BlogPostType = 'journal' | 'rednote' | 'facebook' | 'youtube' | 'instagram';

export interface AdminOrder {
  id: string;
  number: string;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  createdAt: string;
  total: number | null;
  hasCabinetry: boolean;
  invoiceStatus: InvoiceStatus | null;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  latestOrderAt: string | null;
  orderCount: number;
  accountType: 'registered' | 'guest';
  discountPercent: number | null;
}

export interface ManagedProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  detailContent?: ProductDetailContent;
  price: number;
  category: string;
  subcategory: string;
  categoryId: string | null;
  categoryPath: string[];
  themeSlugs: string[];
  finishes: string[];
  colours?: ProductColour[];
  imagePath: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface ProductColour {
  id: string;
  name: string;
  hexCode: string;
}

export interface ManagedProductCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  depth: 1 | 2 | 3;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface ManagedProject {
  id: string;
  name: string;
  slug: string;
  location: string;
  introduction: string;
  coverImagePath: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImagePath: string | null;
  publicationDate: string;
  status: BlogStatus;
  postType: BlogPostType;
  destinationUrl: string | null;
  socialLinks: Partial<Record<'instagram' | 'facebook' | 'xiaohongshu', string>>;
}

export interface ManagedHomeContent {
  heroEyebrow: string;
  heroHeading: string;
  heroCtaLabel: string;
  heroCtaPath: string;
  heroImagePath: string | null;
}

export interface ManagedServicePillar {
  id: string;
  title: string;
  description: string;
  iconKey: 'consultation' | 'joinery' | 'furniture' | 'delivery';
  displayOrder: number;
  isActive: boolean;
}

export interface ManagedStyleRange {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  description: string;
  heroImagePath: string | null;
  roomImagePath: string | null;
  palette: string[];
  displayOrder: number;
  isActive: boolean;
}

export interface ManagedHomeThemeBlock {
  id: string;
  styleRangeId: string;
  rangeSlug: string;
  rangeName: string;
  eyebrow: string;
  headline: string;
  description: string;
  imagePath: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface ManagedPaletteItem {
  id: string;
  styleRangeId: string;
  name: string;
  colour: string;
  imagePath: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface ManagedCabinetryImage {
  id: string;
  cabinetryProductId: string;
  imagePath: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ManagedCabinetryProduct {
  id: string;
  styleRangeId: string;
  rangeSlug: string;
  rangeName: string;
  eyebrow: string;
  headline: string;
  description: string;
  detailContent?: ProductDetailContent;
  scope: string;
  heroImagePath: string | null;
  isActive: boolean;
  images: ManagedCabinetryImage[];
}
