import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createCheckoutQuote } from './index.ts';

Deno.test('creates quote v1 for a furniture-only order instead of an invoice', async () => {
  let quote: Record<string, unknown> | null = null;
  let lines: Array<Record<string, unknown>> = [];
  const repository = {
    insertQuote: async (input: Record<string, unknown>) => {
      quote = input;
      return { id: 'quote-1' };
    },
    insertQuoteLines: async (input: Array<Record<string, unknown>>) => {
      lines = input;
    },
  };

  await createCheckoutQuote(repository, 'order-1', [
    { displayName: 'Japanese Modern Sofa 041', unitPrice: 3290, quantity: 1, finish: 'Natural oak' },
  ], []);

  const { expires_on, ...quoteWithoutExpiry } = quote ?? {};
  assertEquals(quoteWithoutExpiry, { order_id: 'order-1', version: 1, status: 'draft', total: 3290 });
  assertEquals(typeof expires_on, 'string');
  assertEquals(lines[0]?.display_name, 'Japanese Modern Sofa 041');
  assertEquals(lines[0]?.is_tbd, false);
});
