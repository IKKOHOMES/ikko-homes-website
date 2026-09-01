import { useState } from 'react';
import { downloadOrderDocument, emailOrderDocument, type OrderDocumentType } from '../../lib/admin-document';

export function DocumentActions({ documentType, documentId, recipientEmail, disabled = false }: { documentType: OrderDocumentType; documentId: string; recipientEmail: string; disabled?: boolean }) {
  const [working, setWorking] = useState<'download' | 'email' | null>(null);
  const [message, setMessage] = useState('');
  const label = documentType === 'quote' ? 'Quote' : 'Invoice';
  const download = async () => {
    setWorking('download'); setMessage('');
    try { await downloadOrderDocument(documentType, documentId); }
    catch { setMessage('Unable to prepare the document PDF.'); }
    finally { setWorking(null); }
  };
  const email = async () => {
    setWorking('email'); setMessage('');
    try { await emailOrderDocument(documentType, documentId); setMessage(`${label} emailed to ${recipientEmail}.`); }
    catch { setMessage('Unable to email the document.'); }
    finally { setWorking(null); }
  };
  return <div className="document-actions">
    <button className="button" disabled={disabled || working !== null} onClick={() => void download()} type="button">{working === 'download' ? 'Preparing PDF…' : 'Download PDF'}</button>
    <button className="button" disabled={disabled || working !== null || !recipientEmail} onClick={() => void email()} type="button">{working === 'email' ? 'Sending…' : `Email ${label}`}</button>
    {message && <p className={message.startsWith('Unable') ? 'error' : 'admin-success'} role="status">{message}</p>}
  </div>;
}