export interface CabinetryUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export interface FurnitureCartLine {
  id: string;
  kind: 'furniture';
  productId: string;
  productSlug: string;
  name: string;
  price: number;
  quantity: number;
  finish: string;
  imageTone: string;
}

export interface CabinetryCartLine {
  id: string;
  kind: 'cabinetry';
  cabinetryProductId: string;
  rangeId: string;
  name: string;
  price: null;
  quantity: 1;
  upload: CabinetryUpload;
  imageTone: string;
}

export type CartLine = FurnitureCartLine | CabinetryCartLine;

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  note: string;
}

export type DocumentKind = 'invoice' | 'proforma';

export interface MockOrder {
  id: string;
  documentKind: DocumentKind;
  lines: CartLine[];
  customer: CustomerDetails;
}
