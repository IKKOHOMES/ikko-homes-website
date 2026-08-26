import { FormEvent, useState } from 'react';

export function CustomerNoteForm({ onAdd }: { onAdd: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) { setError('Write a note before saving.'); return; }
    setSaving(true); setError('');
    try { await onAdd(body.trim()); setBody(''); } catch { setError('Unable to save the note.'); } finally { setSaving(false); }
  }
  return <form className="customer-note-form" onSubmit={(event) => void submit(event)}><label>New internal note<textarea aria-label="New internal note" onChange={(event) => setBody(event.target.value)} placeholder="Add an internal follow-up or context" value={body} /></label>{error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Add note'}</button></form>;
}
