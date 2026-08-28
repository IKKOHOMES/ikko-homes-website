import { expect, test } from 'vitest';
import { normaliseDocumentResponse } from '../lib/admin-document';

test('normalises a downloadable quote PDF response', () => {
  expect(normaliseDocumentResponse({ filename: 'IKKO-HOMES-Q-1001.pdf', content_base64: 'JVBERi0=' })).toEqual({
    filename: 'IKKO-HOMES-Q-1001.pdf',
    contentBase64: 'JVBERi0=',
  });
});

test('rejects a malformed document response', () => {
  expect(() => normaliseDocumentResponse({ filename: 'IKKO-HOMES-Q-1001.pdf' })).toThrow('Unable to prepare the document.');
});