import { expect, test } from 'vitest';
import { formatInvoiceNumber, formatOrderNumber, formatQuoteNumber } from '../lib/quote-number';

test('formats a monthly QTE quote number with a four-digit sequence', () => {
  expect(formatQuoteNumber('2026-08-30', 1)).toBe('QTE-2026080001');
  expect(formatQuoteNumber('2026-08-30', 42)).toBe('QTE-2026080042');
});

test('formats a monthly order number with a four-letter sequence', () => {
  expect(formatOrderNumber('2026-09-01', 0)).toBe('ORD-202609AAAA');
  expect(formatOrderNumber('2026-09-01', 1)).toBe('ORD-202609AAAB');
  expect(formatOrderNumber('2026-09-01', 25)).toBe('ORD-202609AAAZ');
  expect(formatOrderNumber('2026-09-01', 26)).toBe('ORD-202609AABA');
});

test('formats invoice milestone suffixes in payment-plan sequence order', () => {
  expect(formatInvoiceNumber('2026-08', 1, 1)).toBe('INV-2026080001A');
  expect(formatInvoiceNumber('2026-08', 1, 3)).toBe('INV-2026080001C');
  expect(formatInvoiceNumber('2026-08', 1, 26)).toBe('INV-2026080001Z');
  expect(formatInvoiceNumber('2026-08', 1, 27)).toBe('INV-2026080001AA');
  expect(formatInvoiceNumber('2026-08', 1, 28)).toBe('INV-2026080001AB');
});