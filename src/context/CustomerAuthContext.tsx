import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getCustomerSupabaseClient } from '../lib/supabase';

type CustomerAuth = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  accessError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { firstName: string; lastName: string; email: string; phone: string; password: string }) => Promise<'signed-in' | 'confirmation-required'>;
  signOut: () => Promise<void>;
};

const unavailable = async () => { throw new Error('Customer authentication is unavailable.'); };
const CustomerAuthContext = createContext<CustomerAuth>({ loading: true, session: null, user: null, accessError: '', signIn: unavailable, signUp: unavailable, signOut: unavailable });

export function CustomerAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  useEffect(() => {
    const client = getCustomerSupabaseClient();
    let active = true;
    const sync = async (nextSession: Session | null) => {
      if (!active) return;
      if (!nextSession) { setSession(null); setLoading(false); return; }
      setLoading(true);
      const [profileResult, customerResult] = await Promise.all([
        client.from('profiles').select('id').eq('id', nextSession.user.id).maybeSingle(),
        client.from('customers').select('id').eq('auth_user_id', nextSession.user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (profileResult.data && !profileResult.error) {
        setSession(null); setAccessError('Incorrect email or password.'); setLoading(false);
        void client.auth.signOut({ scope: 'local' });
        return;
      }
      if (profileResult.error || customerResult.error) {
        setSession(null); setAccessError('Incorrect email or password.'); setLoading(false);
        void client.auth.signOut({ scope: 'local' });
        return;
      }
      if (!customerResult.data) {
        setSession(null); setAccessError('Incorrect email or password.'); setLoading(false);
        void client.auth.signOut({ scope: 'local' });
        return;
      }
      setAccessError(''); setSession(nextSession); setLoading(false);
    };
    void client.auth.getSession().then(({ data }) => sync(data.session)).catch(() => { if (active) setLoading(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => { void sync(nextSession); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function signIn(email: string, password: string) {
    setAccessError('');
    const { error } = await getCustomerSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(input: { firstName: string; lastName: string; email: string; phone: string; password: string }) {
    setAccessError('');
    const { data, error } = await getCustomerSupabaseClient().auth.signUp({
      email: input.email, password: input.password,
      options: { data: { first_name: input.firstName, last_name: input.lastName, phone: input.phone, account_type: 'customer' } },
    });
    if (error) throw error;
    return data.session ? 'signed-in' : 'confirmation-required';
  }

  async function signOut() {
    const { error } = await getCustomerSupabaseClient().auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  return <CustomerAuthContext.Provider value={{ loading, session, user: session?.user ?? null, accessError, signIn, signUp, signOut }}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() { return useContext(CustomerAuthContext); }
