import { FormEvent, useMemo, useState } from 'react';
import { validatePaymentPlan, type PaymentPlanDraft } from '../../lib/payment-plan';

export function PaymentPlanEditor({ quoteTotal, instalments, onSave, onGenerate }: {
  quoteTotal: number;
  instalments: PaymentPlanDraft[];
  onSave: (instalments: PaymentPlanDraft[]) => Promise<void>;
  onGenerate: () => Promise<void> | void;
}) {
  const [lines, setLines] = useState(instalments);
  const [savedLines, setSavedLines] = useState(JSON.stringify(instalments));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const validation = useMemo(() => validatePaymentPlan(lines, quoteTotal), [lines, quoteTotal]);
  const update = (index: number, value: Partial<PaymentPlanDraft>) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...value } : line));
  const move = (index: number, offset: number) => setLines((current) => { const next = [...current]; const target = index + offset; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const save = async (event: FormEvent) => { event.preventDefault(); if (!validation.valid) { setError(validation.message); return; } setSaving(true); setError(''); try { await onSave(lines); setSavedLines(JSON.stringify(lines)); } catch { setError('Unable to save the payment plan.'); } finally { setSaving(false); } };
  const isSaved = savedLines === JSON.stringify(lines);
  const generate = async () => { setSaving(true); setError(''); try { await onGenerate(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to generate invoices.'); } finally { setSaving(false); } };
  return <form className="payment-plan-editor" onSubmit={(event) => void save(event)}><div><p className="eyebrow">Payment plan</p><h2>Schedule instalments</h2><p>Confirmed quote total: <b>${quoteTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p></div>
    <div className="payment-plan-editor__lines">{lines.map((line, index) => <fieldset className="payment-plan-editor__line" key={line.id ?? `${index}-${line.label}`}><label>Label<input aria-label={`Instalment ${index + 1} label`} value={line.label} onChange={(event) => update(index, { label: event.target.value })} /></label><label>Amount<input aria-label={`Instalment ${index + 1} amount`} min="0.01" step="0.01" type="number" value={line.amount || ''} onChange={(event) => update(index, { amount: Number(event.target.value) })} /></label><label>Due date<input aria-label={`Instalment ${index + 1} due date`} type="date" value={line.dueOn} onChange={(event) => update(index, { dueOn: event.target.value })} /></label><label>Internal note<input aria-label={`Instalment ${index + 1} internal note`} value={line.internalNote} onChange={(event) => update(index, { internalNote: event.target.value })} /></label><div className="payment-plan-editor__tools"><button className="admin-text-button" disabled={index === 0} onClick={() => move(index, -1)} type="button">↑</button><button className="admin-text-button" disabled={index === lines.length - 1} onClick={() => move(index, 1)} type="button">↓</button><button className="admin-text-button admin-text-button--danger" onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button">Remove</button></div></fieldset>)}</div>
    <button className="admin-secondary-button" type="button" onClick={() => setLines((current) => [...current, { label: '', amount: 0, dueOn: '', internalNote: '' }])}>Add instalment</button>
    <p className="payment-plan-editor__total">Plan total <b>${lines.reduce((sum, line) => sum + (Number.isFinite(line.amount) ? line.amount : 0), 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>{!validation.valid && <p className="error" role="alert">{validation.message}</p>}{error && <p className="error" role="alert">{error}</p>}
    <div className="payment-plan-editor__actions"><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save payment plan'}</button><button className="admin-secondary-button" disabled={!validation.valid || !isSaved || saving} onClick={() => void generate()} type="button">Generate invoices</button></div>
  </form>;
}
