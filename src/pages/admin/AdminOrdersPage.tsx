import { useEffect, useState } from 'react';
import { OrderTable } from '../../components/admin/OrderTable';
import { listAdminOrders } from '../../lib/admin-api';
import type { AdminOrder, OrderStatus } from '../../types/domain';

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { let active = true; setLoading(true); listAdminOrders({ query, status }).then((result) => { if (active) { setOrders(result); setError(''); } }).catch(() => { if (active) setError('Unable to load orders.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [query, status]);

  return <section className="admin-dashboard admin-orders-page"><div className="admin-page-heading"><div><p className="eyebrow">Orders & quotations</p><h1>Orders</h1></div><p>Furniture orders have an invoice. Cabinetry drawings remain T.B.D. until you prepare a quotation.</p></div>
    <div className="admin-filters"><input aria-label="Search orders" onChange={(event) => setQuery(event.target.value)} placeholder="Search order or customer" value={query} /><select aria-label="Order status" onChange={(event) => setStatus(event.target.value as OrderStatus | 'all')} value={status}><option value="all">All statuses</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="quoted">Quoted</option><option value="invoiced">Invoiced</option><option value="completed">Completed</option></select></div>
    {loading ? <p className="admin-empty">Loading orders…</p> : error ? <p className="error" role="alert">{error}</p> : <OrderTable orders={orders} />}
  </section>;
}
