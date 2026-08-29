import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getAdminSupabaseClient } from '../lib/supabase';

type AdminAuth = {
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
  accessError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const unavailable = async () => { throw new Error('Admin authentication is unavailable.'); };
const AdminAuthContext = createContext<AdminAuth>({ loading: true, session: null, isAdmin: false, accessError: '', signIn: unavailable, signOut: unavailable });

export function AdminAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  useEffect(() => {
    const client = getAdminSupabaseClient();
    let active = true;
    const sync = async (nextSession: Session | null) => {
      if (!active) return;
      if (!nextSession) { setIsAdmin(false); setLoading(false); return; }
      setLoading(true);
      const { data, error } = await client.from('profiles').select('role').eq('id', nextSession.user.id).maybeSingle();
      if (!active) return;
      if (!data || error || data.role !== 'admin') {
        setSession(null); setIsAdmin(false); setAccessError('Incorrect email or password.'); setLoading(false);
        void client.auth.signOut({ scope: 'local' });
        return;
      }
      setAccessError(''); setSession(nextSession); setIsAdmin(true); setLoading(false);
    };
    void client.auth.getSession().then(({ data }) => sync(data.session)).catch(() => { if (active) { setIsAdmin(false); setLoading(false); } });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => { void sync(nextSession); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function signIn(email: string, password: string) {
    setAccessError('');
    const { error } = await getAdminSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await getAdminSupabaseClient().auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  return <AdminAuthContext.Provider value={{ loading, session, isAdmin, accessError, signIn, signOut }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() { return useContext(AdminAuthContext); }
