import { Link } from 'react-router-dom';
import type { AdminCustomer } from '../../types/domain';

export function CustomerTable({ customers }: { customers: AdminCustomer[] }) {
  if (!customers.length) return <p className="admin-empty">No customers match this view yet.</p>;
  return <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Customer</th><th>Email</th><th>Type</th><th>Discount</th><th>Phone</th><th>Orders</th><th>Latest order</th><th /></tr></thead>
    <tbody>{customers.map((customer) => <tr key={customer.id}><td><b>{customer.name}</b></td><td>{customer.email}</td><td>{customer.accountType === 'registered' ? 'Registered' : 'Guest'}</td><td>{customer.discountPercent === null ? '—' : `${customer.discountPercent}%`}</td><td>{customer.phone}</td><td>{customer.orderCount}</td><td>{customer.latestOrderAt ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(customer.latestOrderAt)) : '—'}</td><td><Link className="admin-table__action" to={`/admin/customers/${customer.id}`}>View</Link></td></tr>)}</tbody>
  </table></div>;
}
