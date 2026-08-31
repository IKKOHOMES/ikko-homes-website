import { expect, test, vi } from 'vitest';

const invoke = vi.fn();
const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('number allocation is forbidden') });
vi.mock('../lib/supabase', () => ({ getAdminSupabaseClient: () => ({ rpc, functions: { invoke } }) }));

import { downloadOrderDocument, normaliseDocumentResponse } from '../lib/admin-document';

test('normalises a downloadable quote PDF response', () => {
  expect(normaliseDocumentResponse({ filename: 'IKKO-HOMES-Q-1001.pdf', content_base64: 'JVBERi0=' })).toEqual({
    filename: 'IKKO-HOMES-Q-1001.pdf',
    contentBase64: 'JVBERi0=',
  });
});

test('rejects a malformed document response', () => {
  expect(() => normaliseDocumentResponse({ filename: 'IKKO-HOMES-Q-1001.pdf' })).toThrow('Unable to prepare the document.');
});
test('sends a quote download directly to the lifecycle-enforcing document endpoint', async () => {
  invoke.mockResolvedValueOnce({ data: null, error: new Error('draft quote') });

  await expect(downloadOrderDocument('quote', 'quote-1')).rejects.toThrow('Unable to prepare the document.');

  expect(rpc).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenCalledWith('order-document', { body: { action: 'download', document_type: 'quote', document_id: 'quote-1' } });
});