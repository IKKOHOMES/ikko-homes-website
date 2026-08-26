import { expect, test } from 'vitest';
import { calculateFurniturePrice } from '../../supabase/functions/create-order/pricing';

test('locks a percentage discount against a furniture list price', () => {
  expect(calculateFurniturePrice(1299, 12.5, 2)).toEqual({
    listUnitPrice: 1299,
    chargedUnitPrice: 1136.63,
    discountTotal: 324.74,
  });
});

test('does not calculate a discount for an invalid percentage', () => {
  expect(calculateFurniturePrice(1299, 200, 1)).toEqual({
    listUnitPrice: 1299,
    chargedUnitPrice: 1299,
    discountTotal: 0,
  });
});
