import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { filenameForOrderDocument } from './pdf.ts';

Deno.test('creates an IKKO Homes PDF filename from a document reference', () => {
  assertEquals(filenameForOrderDocument('IKKO Q-1001'), 'IKKO-HOMES-IKKO-Q-1001.pdf');
});