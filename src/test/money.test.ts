import { expect, test } from 'vitest';
import { hasExactTotal, toCents } from '../lib/money';

test('accepts instalments that equal a quote total to cents', () => {
  expect(toCents(100.005)).toBe(10001);
  expect(hasExactTotal([500, 250.5, 249.5], 1000)).toBe(true);
  expect(hasExactTotal([500, 250.49, 249.5], 1000)).toBe(false);
});
