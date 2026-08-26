import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';

const navigation = [
  ['Dashboard', '/admin/dashboard'],
  ['Orders', '/admin/orders'],
  ['Customers', '/admin/customers'],
  ['Products', '/admin/products'],
  ['Categories', '/admin/categories'],
  ['Content', '/admin/content'],
  ['Projects', '/admin/projects'],
  ['Blogs & Media', '/admin/blogs'],
  ['Settings', '/admin/settings'],
] as const;

type AdminShellProps = PropsWithChildren<{ onSignOut: () => void | Promise<void> }>;

export function AdminShell({ children, onSignOut }: AdminShellProps) {
  return <section className="admin-shell">
    <aside className="admin-shell__sidebar">
      <NavLink className="admin-shell__brand" to="/admin/dashboard">ikko<span>homes</span><small>Internal platform</small></NavLink>
      <nav aria-label="Admin navigation" className="admin-shell__nav">
        {navigation.map(([label, path]) => <NavLink className={({ isActive }) => isActive ? 'is-active' : ''} key={path} to={path}>{label}</NavLink>)}
      </nav>
      <button className="admin-shell__signout" onClick={() => void onSignOut()} type="button">Sign out</button>
    </aside>
    <div className="admin-shell__content">{children}</div>
  </section>;
}
