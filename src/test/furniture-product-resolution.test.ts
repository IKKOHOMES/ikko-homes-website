import { describe, expect, it, vi } from 'vitest';
import { resolveFurnitureProducts } from '../../supabase/functions/create-order/product-resolution';

describe('resolveFurnitureProducts', () => {
  it('uses a valid product ID without querying legacy slug or name fields', async () => {
    const lookup = vi.fn(async (field: 'id' | 'slug' | 'name', values: string[]) => {
      if (field !== 'id') throw new Error(`Unexpected ${field} lookup`);
      expect(values).toEqual(['6bdd4e36-17e7-4df1-b377-e1de5bf3e010']);
      return [{ id: values[0], slug: 'japanese-modern-sofa-041', name: 'Japanese Modern Sofa 041', price: 3290 }];
    });

    const products = await resolveFurnitureProducts(
      [{
        productId: '6bdd4e36-17e7-4df1-b377-e1de5bf3e010',
        slug: 'legacy product/with invalid lookup characters',
        name: 'Old product name',
      }],
      lookup,
    );

    expect(products.get('6bdd4e36-17e7-4df1-b377-e1de5bf3e010')?.name).toBe('Japanese Modern Sofa 041');
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
