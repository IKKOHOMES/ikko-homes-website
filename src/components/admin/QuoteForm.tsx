import { FormEvent, useState } from 'react';

export type QuoteInput = { orderId: string; total: number; expiresOn: string; internalNote: string };

export function QuoteForm({ orderId, onSave }: { orderId: string; onSave: (input: QuoteInput) => Promise<void> }) {
  const [total, setTotal] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(total);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a quotation amount greater than zero.'); return; }
    if (!expiresOn) { setError('Choose a quote expiry date.'); return; }
    setSaving(true); setError('');
    try { await onSave({ orderId, total: amount, expiresOn, internalNote: internalNote.trim() }); }
    catch { setError('Unable to save the quotation.'); }
    finally { setSaving(false); }
  }

  return <form className="quote-form" onSubmit={(event) => void submit(event)}>
    <h2>Prepare quotation</h2>
    <label>Quote total<input aria-label="Quote total" min="0" onChange={(event) => setTotal(event.target.value)} placeholder="0.00" step="0.01" type="number" value={total} /></label>
    <label>Expiry date<input aria-label="Quote expiry date" onChange={(event) => setExpiresOn(event.target.value)} type="date" value={expiresOn} /></label>
    <label>Internal note<textarea onChange={(event) => setInternalNote(event.target.value)} placeholder="Scope, exclusions or supplier notes" value={internalNote} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save quotation'}</button>
  </form>;
}
