import { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../lib/admin-api';

type Settings = Awaited<ReturnType<typeof getSettings>>;

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setSettings(await getSettings());
    } catch {
      setSettings(null);
      setLoadError('Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <section className="admin-dashboard">Loading settings…</section>;

  if (loadError || !settings) {
    return <section className="admin-dashboard">
      <p className="eyebrow">Studio settings</p>
      <h1>Settings</h1>
      <p className="error" role="alert">{loadError || 'Unable to load settings.'}</p>
      <button className="button" onClick={() => void load()} type="button">Retry</button>
    </section>;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const settingsToSave = settings;
    if (!settingsToSave) return;
    try {
      await saveSettings(settingsToSave);
      setMessage('Saved.');
    } catch {
      setMessage('Unable to save settings.');
    }
  }

  return <section className="admin-dashboard">
    <p className="eyebrow">Studio settings</p>
    <h1>Settings</h1>
    <form className="product-form" onSubmit={(event) => void submit(event)}>
      {([['studioAddress', 'Address'], ['studioEmail', 'Email'], ['studioPhone', 'Phone'], ['invoicePrefix', 'Invoice prefix']] as const).map(([key, label]) => <label key={key}>{label}
        <input onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} value={settings[key]} />
      </label>)}
      {message && <p className={message === 'Saved.' ? '' : 'error'} role={message === 'Saved.' ? 'status' : 'alert'}>{message}</p>}
      <button className="button">Save settings</button>
    </form>
  </section>;
}
