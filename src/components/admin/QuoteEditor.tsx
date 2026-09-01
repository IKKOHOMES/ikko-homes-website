import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import type { EditableQuote, QuoteSaveInput } from '../../lib/admin-api';
import { calculateQuoteTotals } from '../../lib/payment-plan';

export function QuoteEditor({ quote, onSave, onConfirm, documentActions }: {
  quote: EditableQuote;
  onSave: (input: QuoteSaveInput) => Promise<void>;
  onConfirm: (quoteId: string) => Promise<void>;
  documentActions?: ReactNode;
}) {
  const [lines, setLines] = useState(quote.lines);
  const [expiresOn, setExpiresOn] = useState(quote.expiresOn);
  const [internalNote, setInternalNote] = useState(quote.internalNote);
  const [discountTotal, setDiscountTotal] = useState(quote.discountTotal ?? 0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const totals = useMemo(() => calculateQuoteTotals(lines.filter((line) => !line.isTbd), discountTotal), [lines, discountTotal]);
  const updateLine = (index: number, value: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...value } : line));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!expiresOn) { setError('Choose a quote expiry date.'); return; }
    if (!Number.isFinite(discountTotal) || discountTotal < 0) { setError('Enter a non-negative discount.'); return; }
    if (!lines.length || lines.some((line) => !line.displayName.trim() || !Number.isInteger(line.quantity) || line.quantity <= 0 || (!line.isTbd && (!Number.isFinite(line.unitPrice) || line.unitPrice < 0)))) { setError('Complete every quote line before saving.'); return; }
    setSaving(true); setError('');
    try { await onSave({ quoteId: quote.id, orderId: quote.orderId, expiresOn, internalNote: internalNote.trim(), discountTotal, lines }); }
    catch { setError('Unable to save the quotation.'); }
    finally { setSaving(false); }
  };
  const confirm = async () => {
    if (!expiresOn) { setError('Choose a quote expiry date.'); return; }
    if (!Number.isFinite(discountTotal) || discountTotal < 0) { setError('Enter a non-negative discount.'); return; }
    if (lines.some((line) => line.isTbd)) { setError('Price every quote line before confirming.'); return; }
    if (lines.some((line) => !line.displayName.trim() || !Number.isInteger(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) { setError('Complete every quote line before confirming.'); return; }
    setSaving(true); setError('');
    try { await onSave({ quoteId: quote.id, orderId: quote.orderId, expiresOn, internalNote: internalNote.trim(), discountTotal, lines }); await onConfirm(quote.id); }
    catch { setError('Unable to confirm the quotation.'); }
    finally { setSaving(false); }
  };
  return <form className="quote-editor" onSubmit={(event) => void save(event)}>
    <div className="quote-editor__header"><div><p className="eyebrow">{quote.quoteNumber ? `Quote ${quote.quoteNumber} · v${quote.version}` : `Quote v${quote.version}`}</p><h2>{quote.status === 'confirmed' ? 'Create revised quote' : 'Prepare quotation'}</h2></div>{documentActions}</div>
    <div className="quote-editor__lines">{lines.map((line, index) => <fieldset className="quote-editor__line" key={line.id ?? `${index}-${line.displayName}`}>
      <label>Description<input aria-label={`Line ${index + 1} description`} value={line.displayName} onChange={(event) => updateLine(index, { displayName: event.target.value })} /></label>
      <label>Qty<input aria-label={`Line ${index + 1} quantity`} min="1" type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></label>
      <label>Unit price<input aria-label={`Line ${index + 1} unit price`} disabled={line.isTbd} min="0" step="0.01" type="number" value={line.isTbd ? '' : line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} /></label>
      <label className="quote-editor__tbd"><input aria-label={`Line ${index + 1} T.B.D.`} checked={line.isTbd} type="checkbox" onChange={(event) => updateLine(index, { isTbd: event.target.checked, unitPrice: event.target.checked ? 0 : line.unitPrice })} /> T.B.D.</label>
      <button className="admin-text-button admin-text-button--danger" type="button" onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Remove</button>
    </fieldset>)}</div>
    <button className="admin-secondary-button" type="button" onClick={() => setLines((current) => [...current, { displayName: '', unitPrice: 0, quantity: 1, isTbd: false }])}>Add row</button>
    <div className="quote-editor__meta"><label>Discount<input aria-label="Quote discount" min="0" step="0.01" type="number" value={discountTotal || ''} onChange={(event) => setDiscountTotal(Number(event.target.value))} /></label><label>Expiry date<input aria-label="Quote expiry date" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></label><label>Internal note<textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></label></div>
    <p className="quote-editor__total">Subtotal <b>${totals.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> · GST <b>${totals.gstTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> · Quote total <b>${totals.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="quote-editor__actions"><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save quote'}</button>{quote.status !== 'confirmed' && <button className="admin-secondary-button" disabled={saving} onClick={() => void confirm()} type="button">Confirm quote</button>}</div>
  </form>;
}
