import { getAdminSupabaseClient } from './supabase';

export type OrderDocumentType = 'quote' | 'invoice';
export type DownloadableOrderDocument = { filename: string; contentBase64: string };

export function normaliseDocumentResponse(value: unknown): DownloadableOrderDocument {
  if (!value || typeof value !== 'object') throw new Error('Unable to prepare the document.');
  const response = value as { filename?: unknown; content_base64?: unknown };
  if (typeof response.filename !== 'string' || !response.filename.endsWith('.pdf') || typeof response.content_base64 !== 'string' || !response.content_base64) {
    throw new Error('Unable to prepare the document.');
  }
  return { filename: response.filename, contentBase64: response.content_base64 };
}

function downloadBase64Pdf(document: DownloadableOrderDocument) {
  const bytes = Uint8Array.from(atob(document.contentBase64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = document.filename;
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadOrderDocument(documentType: OrderDocumentType, documentId: string): Promise<void> {
  const { data, error } = await getAdminSupabaseClient().functions.invoke('order-document', { body: { action: 'download', document_type: documentType, document_id: documentId } });
  if (error) throw new Error('Unable to prepare the document.');
  downloadBase64Pdf(normaliseDocumentResponse(data));
}

export async function emailOrderDocument(documentType: OrderDocumentType, documentId: string): Promise<void> {
  const { data, error } = await getAdminSupabaseClient().functions.invoke('order-document', { body: { action: 'email', document_type: documentType, document_id: documentId } });
  if (error || !data || typeof data !== 'object' || (data as { sent?: unknown }).sent !== true) throw new Error('Unable to email the document.');
}