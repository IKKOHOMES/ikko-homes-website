import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { CartLine, CabinetryUpload } from '../types/order';
import type { Product } from '../types/catalog';

type CabinetryProductSelection = { id: string; rangeId: string; name: string };
type CartApi = { lines: CartLine[]; addFurniture: (product: Product, finish: string, quantity: number) => void; addCabinetry: (product: CabinetryProductSelection, upload: CabinetryUpload) => void; removeLine: (id: string) => void; clear: () => void; count: number };
const Cart = createContext<CartApi | null>(null);
export function CartProvider({ children }: PropsWithChildren) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const value = useMemo<CartApi>(() => ({
    lines,
    count: lines.reduce((total, line) => total + line.quantity, 0),
    addFurniture: (product, finish, quantity) => setLines((current) => [...current, { id: `${product.id}-${Date.now()}`, kind: 'furniture', productId: product.id, productSlug: product.slug, name: product.name, price: product.price, quantity, finish, imageTone: product.imageTone }]),
    addCabinetry: (product, upload) => { if (!upload) throw new Error('A drawing is required'); setLines((current) => [...current, { id: `cabinetry-${Date.now()}`, kind: 'cabinetry', cabinetryProductId: product.id, rangeId: product.rangeId, name: product.name, price: null, quantity: 1, upload, imageTone: 'cabinetry' }]); },
    removeLine: (id) => setLines((current) => current.filter((line) => line.id !== id)),
    clear: () => setLines([]),
  }), [lines]);
  return <Cart.Provider value={value}>{children}</Cart.Provider>;
}
export function useCart() { const cart = useContext(Cart); if (!cart) throw new Error('useCart must be used within CartProvider'); return cart; }
