export function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function fromCents(cents: number) {
  return cents / 100;
}

export function hasExactTotal(amounts: number[], expected: number) {
  return amounts.reduce((sum, amount) => sum + toCents(amount), 0) === toCents(expected);
}
