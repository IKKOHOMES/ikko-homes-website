import { FormEvent, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { CustomerAccountPage } from './CustomerAccountPage';

export function CustomerAuthPage() {
  const { signIn, signUp, user, accessError: customerAccessError } = useCustomerAuth();
  const { isAdmin, signIn: signInAsAdministrator, accessError: administratorAccessError } = useAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const administratorMode = searchParams.get('mode') === 'admin';
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setSubmitting(true);
    try {
      if (administratorMode) await signInAsAdministrator(email, password);
      else if (mode === 'login') await signIn(email, password);
      else {
        const result = await signUp({ firstName, lastName, email, password });
        if (result === 'confirmation-required') setNotice('Check your email to confirm your account.');
      }
    } catch { setError(administratorMode || mode === 'login' ? 'Incorrect email or password.' : 'Unable to create your account.'); } finally { setSubmitting(false); }
  }
  if (administratorMode && isAdmin) return <Navigate replace to="/admin/dashboard" />;
  if (!administratorMode && user) return <CustomerAccountPage />;
  const creating = mode === 'signup';
  const accessError = administratorMode ? administratorAccessError : customerAccessError;
  const switchTo = (nextAdministratorMode: boolean) => {
    setError(''); setNotice(''); setMode('login');
    setSearchParams(nextAdministratorMode ? { mode: 'admin' } : {}, { replace: true });
  };
  return <section className="content-section customer-auth"><form onSubmit={submit}><p className="eyebrow">{administratorMode ? 'IKKO Homes administration' : 'IKKO Homes account'}</p><h1>{administratorMode ? 'Administrator sign in' : creating ? 'Create your account' : 'Welcome back'}</h1><p>{administratorMode ? 'Log in for administration' : creating ? 'Create an account to keep your orders and invoices in one place.' : 'Log in to view your orders, quotations and invoices.'}</p>{creating && !administratorMode && <div className="form-grid"><label>First name<input autoComplete="given-name" onChange={(event) => setFirstName(event.target.value)} required value={firstName} /></label><label>Last name<input autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} required value={lastName} /></label></div>}<label>Email address<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label>Password<input autoComplete={creating && !administratorMode ? 'new-password' : 'current-password'} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>{(error || accessError) && <p className="error" role="alert">{error || accessError}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}<button className="button" disabled={submitting} type="submit">{submitting ? 'Please wait…' : administratorMode ? 'LOG IN' : creating ? 'Create account' : 'Log in'}</button>{administratorMode ? <button className="text-button" onClick={() => switchTo(false)} type="button">Switch to customer login</button> : creating ? <button className="text-button" onClick={() => setMode('login')} type="button">Back to login</button> : <><button className="text-button" onClick={() => setMode('signup')} type="button">Create account</button><button className="text-button" onClick={() => switchTo(true)} type="button">Switch to administrator</button></>}</form></section>;
}
