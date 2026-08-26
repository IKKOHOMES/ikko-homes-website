import { useEffect, useState } from 'react';
import { CustomerTable } from '../../components/admin/CustomerTable';
import { listCustomers } from '../../lib/admin-api';
import type { AdminCustomer } from '../../types/domain';

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; setLoading(true); listCustomers(query).then((value) => { if (active) { setCustomers(value); setError(''); } }).catch(() => { if (active) setError('Unable to load customers.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [query]);
  return <section className="admin-dashboard"><div className="admin-page-heading"><div><p className="eyebrow">Customer CRM</p><h1>Customers</h1></div><p>Customer contacts, order history and private internal notes.</p></div><div className="admin-filters"><input aria-label="Search customers" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" value={query} /></div>{loading ? <p className="admin-empty">Loading customers…</p> : error ? <p className="error" role="alert">{error}</p> : <CustomerTable customers={customers} />}</section>;
}
