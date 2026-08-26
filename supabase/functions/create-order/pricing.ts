export type FurniturePrice = {
  listUnitPrice: number;
  chargedUnitPrice: number;
  discountTotal: number;
};

const toCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateFurniturePrice(listUnitPrice: number, discountPercent: number, quantity: number): FurniturePrice {
  const safeDiscount = Number.isFinite(discountPercent) && discountPercent >= 0 && discountPercent <= 100 ? discountPercent : 0;
  const chargedUnitPrice = toCurrency(listUnitPrice * (1 - safeDiscount / 100));
  return {
    listUnitPrice,
    chargedUnitPrice,
    discountTotal: toCurrency((listUnitPrice - chargedUnitPrice) * quantity),
  };
}
