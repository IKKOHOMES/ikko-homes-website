import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import type { EditableQuote, QuoteSaveInput } from '../../lib/admin-api';
import { calculateQuoteTotals } from '../../lib/payment-plan';

function formatQuoteDate(value?: string) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function QuoteEditor({ quote, onSave, onConfirm, documentActions }: {
  quote: EditableQuote;
  onSave: (input: QuoteSaveInput) => Promise<void>;
  onConfirm: (quoteId: string) => Promise<void>;
  documentActions?: ReactNode;
}) {
  const [lines, setLines] = useState(quote.lines);
  const [expiresOn, setExpiresOn] = useState(quote.expiresOn);
  const subtotal = useMemo(() => calculateQuoteTotals(lines.filter((line) => !line.isTbd), 0).subtotal, [lines]);
  const [discountPercentage, setDiscountPercentage] = useState(() => subtotal > 0 ? ((quote.discountTotal ?? 0) / subtotal) * 100 : 0);
  const discountTotal = useMemo(() => subtotal * discountPercentage / 100, [discountPercentage, subtotal]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const totals = useMemo(() => calculateQuoteTotals(lines.filter((line) => !line.isTbd), discountTotal), [lines, discountTotal]);
  const updateLine = (index: number, value: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...value } : line));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!expiresOn) { setError('Choose a quote expiry date.'); return; }
    if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) { setError('Enter a discount between 0% and 100%.'); return; }
    if (!lines.length || lines.some((line) => !line.displayName.trim() || !Number.isInteger(line.quantity) || line.quantity <= 0 || (!line.isTbd && (!Number.isFinite(line.unitPrice) || line.unitPrice < 0)))) { setError('Complete every quote line before saving.'); return; }
    setSaving(true); setError('');
    try { await onSave({ quoteId: quote.id, orderId: quote.orderId, expiresOn, internalNote: quote.internalNote, discountTotal, lines }); }
    catch { setError('Unable to save the quotation.'); }
    finally { setSaving(false); }
  };
  const confirm = async () => {
    if (!expiresOn) { setError('Choose a quote expiry date.'); return; }
    if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) { setError('Enter a discount between 0% and 100%.'); return; }
    if (lines.some((line) => line.isTbd)) { setError('Price every quote line before confirming.'); return; }
    if (lines.some((line) => !line.displayName.trim() || !Number.isInteger(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) { setError('Complete every quote line before confirming.'); return; }
    setSaving(true); setError('');
    try { await onSave({ quoteId: quote.id, orderId: quote.orderId, expiresOn, internalNote: quote.internalNote, discountTotal, lines }); await onConfirm(quote.id); }
    catch { setError('Unable to confirm the quotation.'); }
    finally { setSaving(false); }
  };
  return <form className="quote-editor" onSubmit={(event) => void save(event)}><div className="quote-editor__layout"><div className="quote-editor__main">
    <div className="quote-editor__header"><div><p className="eyebrow">{quote.quoteNumber ? `Quote ${quote.quoteNumber} · v${quote.version}` : `Quote v${quote.version}`}</p><h2>{quote.status === 'confirmed' ? 'Create revised quote' : 'Prepare quotation'}</h2></div>{documentActions}</div>
    <div className="quote-editor__lines"><div className="quote-editor__line-header"><span>No.</span><span>Item &amp; description</span><span>Quantity</span><span>Rate</span><span>Amount</span><span aria-hidden="true" /></div>{lines.map((line, index) => <fieldset className="quote-editor__line" key={line.id ?? `${index}-${line.displayName}`}>
      <output className="quote-editor__line-number">{index + 1}</output>
      <div className="quote-editor__field"><input aria-label={`Line ${index + 1} description`} value={line.displayName} onChange={(event) => updateLine(index, { displayName: event.target.value })} /></div>
      <div className="quote-editor__field"><input aria-label={`Line ${index + 1} quantity`} min="1" type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></div>
      <div className="quote-editor__field"><input aria-label={`Line ${index + 1} rate`} inputMode="decimal" onChange={(event) => { const value = event.target.value.trim(); const rate = Number(value); updateLine(index, value === '' || value.toUpperCase() === 'T.B.D.' ? { isTbd: true, unitPrice: 0 } : { isTbd: false, unitPrice: Number.isFinite(rate) ? rate : 0 }); }} onFocus={(event) => { if (line.isTbd) event.currentTarget.select(); }} type="text" value={line.isTbd ? 'T.B.D.' : line.unitPrice} /></div>
      <output aria-label={`Line ${index + 1} amount`} className="quote-editor__amount">{line.isTbd ? 'T.B.D.' : `$${(line.quantity * line.unitPrice).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</output>
      <div className="quote-editor__line-actions"><button className="admin-text-button admin-text-button--danger" type="button" onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Remove</button></div>
    </fieldset>)}</div>
    <button className="admin-secondary-button" type="button" onClick={() => setLines((current) => [...current, { displayName: '', unitPrice: 0, quantity: 1, isTbd: false }])}>Add row</button>
    <div className="quote-editor__meta"><p className="quote-editor__subtotal">Subtotal <b>${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p><label className="quote-editor__discount">Discount<span><input aria-label="Quote discount percentage" max="100" min="0" step="0.01" type="number" value={discountPercentage || ''} onChange={(event) => setDiscountPercentage(Number(event.target.value))} /><b>%</b></span></label></div>
    <p className="quote-editor__total">Discounted subtotal <b>${(totals.subtotal - totals.discountTotal).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> · GST <b>${totals.gstTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> · Quote total <b>${totals.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="quote-editor__actions"><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save quote'}</button>{quote.status !== 'confirmed' && <button className="admin-secondary-button" disabled={saving} onClick={() => void confirm()} type="button">Confirm quote</button>}</div>
    </div><aside aria-label="Quote information" className="quote-editor__details"><dl><div><dt>Quote no.</dt><dd>{quote.quoteNumber ?? 'Pending'}</dd></div><div><dt>Issue date</dt><dd>{formatQuoteDate(quote.createdAt)}</dd></div><div><dt>Expiry date</dt><dd><input aria-label="Quote expiry date" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></dd></div></dl></aside></div>
  </form>;
}