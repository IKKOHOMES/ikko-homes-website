import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { updateScheduleAmount, updateSchedulePercent, validatePaymentPlan, type PaymentPlanDraft } from '../../lib/payment-plan';
type EditablePaymentPlanInstalment = PaymentPlanDraft & { status?: 'draft' | 'issued' | 'paid' | 'overdue' };
type LocalLine = EditablePaymentPlanInstalment & { clientKey: string; dirty: boolean };

function draftValue(line: EditablePaymentPlanInstalment) {
  return JSON.stringify({ label: line.label, percentage: line.percentage, amount: line.amount, dueOn: line.dueOn, internalNote: line.internalNote });
}
function toDraft(line: LocalLine): PaymentPlanDraft { return { id: line.id, label: line.label, percentage: line.percentage, amount: line.amount, dueOn: line.dueOn, internalNote: line.internalNote }; }

export function PaymentPlanEditor({ quoteTotal, instalments, onSave, onSync }: {
  quoteTotal: number;
  instalments: EditablePaymentPlanInstalment[];
  onSave: (instalments: PaymentPlanDraft[]) => Promise<PaymentPlanDraft[]>;
  onSync: () => Promise<void> | void;
}) {
  const clientKeySequence = useRef(0);
  const newClientKey = () => `payment-plan-${++clientKeySequence.current}`;
  const [lines, setLines] = useState<LocalLine[]>(() => instalments.map((line) => ({ ...line, clientKey: newClientKey(), dirty: false })));
  const [savedLines, setSavedLines] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState('');
  const previousInstalments = useRef(instalments);
  const localOrderDirty = useRef(false);

  useEffect(() => {
    const previous = previousInstalments.current;
    setLines((current) => {
      const currentById = new Map(current.filter((line) => line.id).map((line) => [line.id as string, line]));
      const previousById = new Map(previous.filter((line) => line.id).map((line) => [line.id as string, line]));
      const mergedById = new Map<string, LocalLine>();
      let hasConflict = false;

      for (const serverLine of instalments) {
        if (!serverLine.id) continue;
        const localLine = currentById.get(serverLine.id);
        const previousLine = previousById.get(serverLine.id);
        if (localLine?.dirty) {
          if (previousLine && draftValue(serverLine) !== draftValue(previousLine)) hasConflict = true;
          mergedById.set(serverLine.id, { ...localLine, status: serverLine.status });
        } else {
          mergedById.set(serverLine.id, { ...serverLine, clientKey: localLine?.clientKey ?? newClientKey(), dirty: false });
        }
      }

      const missingDirtyLines = current.filter((line) => line.id && line.dirty && !mergedById.has(line.id));
      if (missingDirtyLines.length) {
        hasConflict = true;
        for (const line of missingDirtyLines) mergedById.set(line.id as string, line);
      }

      const serverIds = new Set(instalments.flatMap((line) => line.id ? [line.id] : []));
      const previousIds = previous.flatMap((line) => line.id ? [line.id] : []);
      const nextIds = instalments.flatMap((line) => line.id ? [line.id] : []);
      if (localOrderDirty.current && JSON.stringify(previousIds) !== JSON.stringify(nextIds)) hasConflict = true;
      const nextLines = localOrderDirty.current
        ? [...current.filter((line) => !line.id || mergedById.has(line.id)).map((line) => line.id ? mergedById.get(line.id as string)! : line), ...instalments.filter((line) => line.id && !currentById.has(line.id)).map((line) => mergedById.get(line.id as string)!)]
        : [...instalments.filter((line) => line.id).map((line) => mergedById.get(line.id as string)!), ...current.filter((line) => !line.id)];
      if (nextLines.some((line) => !line)) return current;
      if (serverIds.size === 0 && current.length) return current;
      if (hasConflict) setConflict('The payment schedule changed on the server while you were editing. Review your local changes before saving.');
      return nextLines;
    });
    previousInstalments.current = instalments;
  }, [instalments]);

  const validation = useMemo(() => validatePaymentPlan(lines, quoteTotal), [lines, quoteTotal]);
  const update = (index: number, value: Partial<PaymentPlanDraft>) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...value, dirty: true } : line));
  const lastEditableIndex = (current: EditablePaymentPlanInstalment[]) => current.reduce((last, line, index) => line.status === undefined || line.status === 'draft' ? index : last, -1);
  const updatePercent = (index: number, percentage: number) => { try { setLines((current) => { const next = updateSchedulePercent(current, index, percentage, quoteTotal, lastEditableIndex(current)); return next.map((line, lineIndex) => ({ ...line, clientKey: current[lineIndex].clientKey, dirty: true })); }); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update instalment.'); } };
  const updateAmount = (index: number, amount: number) => { try { setLines((current) => { const next = updateScheduleAmount(current, index, amount, quoteTotal, lastEditableIndex(current)); return next.map((line, lineIndex) => ({ ...line, clientKey: current[lineIndex].clientKey, dirty: true })); }); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update instalment.'); } };
  const move = (index: number, offset: number) => setLines((current) => { const next = [...current]; const target = index + offset; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; localOrderDirty.current = true; return next; });
  const save = async (event: FormEvent) => { event.preventDefault(); if (!validation.valid) { setError(validation.message); return; } setSaving(true); setError(''); try { const saved = await onSave(lines.map(toDraft)); const savedById = new Map(lines.filter((line) => line.id).map((line) => [line.id as string, line.clientKey])); const next = saved.map((line, index) => ({ ...line, clientKey: line.id ? savedById.get(line.id) ?? newClientKey() : lines[index]?.clientKey ?? newClientKey(), dirty: false })); setLines(next); setSavedLines(JSON.stringify(saved)); setConflict(''); localOrderDirty.current = false; previousInstalments.current = saved; } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the payment schedule.'); } finally { setSaving(false); } };
  const isSaved = savedLines === JSON.stringify(lines.map(toDraft));
  const sync = async () => { setSaving(true); setError(''); try { await onSync(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to synchronise invoice drafts.'); } finally { setSaving(false); } };
  return <form className="payment-plan-editor" onSubmit={(event) => void save(event)}><div><p className="eyebrow">Payment plan</p><h2>Schedule instalments</h2><p>Confirmed quote total: <b>${quoteTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p></div>
    <div className="payment-plan-editor__lines">{lines.map((line, index) => <fieldset disabled={line.status === 'issued' || line.status === 'paid' || line.status === 'overdue'} className="payment-plan-editor__line" key={line.clientKey}><label>Description<input aria-label={`Instalment ${index + 1} description`} value={line.label} onChange={(event) => update(index, { label: event.target.value })} /></label><label>Percent<input aria-label={`Instalment ${index + 1} percent`} min="0" step="0.01" type="number" value={line.percentage || ''} onChange={(event) => updatePercent(index, Number(event.target.value))} /></label><label>Amount<input aria-label={`Instalment ${index + 1} amount`} min="0" step="0.01" type="number" value={line.amount || ''} onChange={(event) => updateAmount(index, Number(event.target.value))} /></label><label>Due date<input aria-label={`Instalment ${index + 1} due date`} type="date" value={line.dueOn} onChange={(event) => update(index, { dueOn: event.target.value })} /></label><label>Internal note<input aria-label={`Instalment ${index + 1} internal note`} value={line.internalNote} onChange={(event) => update(index, { internalNote: event.target.value })} /></label><div className="payment-plan-editor__tools"><button aria-label={`Move instalment ${index + 1} up`} className="admin-text-button" disabled={line.status === 'issued' || line.status === 'paid' || line.status === 'overdue' || index === 0 || lines[index - 1]?.status === 'issued' || lines[index - 1]?.status === 'paid' || lines[index - 1]?.status === 'overdue'} onClick={() => move(index, -1)} type="button">↑</button><button aria-label={`Move instalment ${index + 1} down`} className="admin-text-button" disabled={line.status === 'issued' || line.status === 'paid' || line.status === 'overdue' || index === lines.length - 1 || lines[index + 1]?.status === 'issued' || lines[index + 1]?.status === 'paid' || lines[index + 1]?.status === 'overdue'} onClick={() => move(index, 1)} type="button">↓</button><button className="admin-text-button admin-text-button--danger" disabled={line.status === 'issued' || line.status === 'paid' || line.status === 'overdue'} onClick={() => { localOrderDirty.current = true; setLines((current) => current.filter((_, currentIndex) => currentIndex !== index)); }} type="button">Remove</button></div></fieldset>)}</div>
    <button className="admin-secondary-button" type="button" onClick={() => setLines((current) => [...current, { label: '', percentage: 0, amount: 0, dueOn: '', internalNote: '', clientKey: newClientKey(), dirty: true }])}>Add instalment</button>
    <p className="payment-plan-editor__total">Plan total <b>${lines.reduce((sum, line) => sum + (Number.isFinite(line.amount) ? line.amount : 0), 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>{!validation.valid && <p className="error" role="alert">{validation.message}</p>}{conflict && <p className="error" role="alert">{conflict}</p>}{error && <p className="error" role="alert">{error}</p>}
    <div className="payment-plan-editor__actions"><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save payment schedule'}</button><button className="admin-secondary-button" disabled={!validation.valid || !isSaved || saving} onClick={() => void sync()} type="button">Sync invoice drafts</button></div>
  </form>;
}