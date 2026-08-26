import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, accessError } = useAdminAuth();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      await signIn(email, password);
      navigate('/admin/dashboard');
    } catch {
      setError('Incorrect email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="admin-login"><form onSubmit={submit}><p className="eyebrow">IKKO Homes</p><h1>Administrator sign in</h1><p>Use your internal IKKO Homes account to manage orders, quotations and content.</p><label>Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label>Password<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>{(error || accessError) && <p className="error" role="alert">{error || accessError}</p>}<button className="button" disabled={submitting} type="submit">{submitting ? 'Signing in…' : 'Sign in'}</button></form></section>;
}
