import { expect, test } from 'vitest';
import { formatQuoteNumber } from '../lib/quote-number';

test('formats a monthly quote number without separators', () => {
  expect(formatQuoteNumber('2026-08-30', 1)).toBe('IKKO2026080001');
  expect(formatQuoteNumber('2026-08-30', 42)).toBe('IKKO2026080042');
});