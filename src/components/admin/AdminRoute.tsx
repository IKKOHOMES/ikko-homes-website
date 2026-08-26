import { Navigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AdminShell } from './AdminShell';

export function AdminRoute({ children }: PropsWithChildren) {
  const { loading, session, isAdmin, signOut } = useAdminAuth();
  if (loading) return <section className="admin-dashboard"><p>Checking sign in…</p></section>;
  if (!session || !isAdmin) return <Navigate replace to="/account?mode=admin" />;
  return <AdminShell onSignOut={() => { void signOut(); }}>{children}</AdminShell>;
}
