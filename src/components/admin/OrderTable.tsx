import { Link } from 'react-router-dom';
import type { AdminOrder } from '../../types/domain';
import { StatusBadge } from './StatusBadge';

export function OrderTable({ orders }: { orders: AdminOrder[] }) {
  if (!orders.length) return <p className="admin-empty">No orders match this view yet.</p>;
  return <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Order</th><th>Customer</th><th>Submitted</th><th>Type</th><th>Total</th><th>Status</th><th /></tr></thead>
    <tbody>{orders.map((order) => <tr key={order.id}>
      <td><b>{order.number}</b></td><td>{order.customerName}</td><td>{new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(order.createdAt))}</td>
      <td>{order.hasCabinetry ? 'Cabinetry' : 'Furniture'}</td><td>{order.total === null ? 'T.B.D.' : `$${order.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</td>
      <td><StatusBadge status={order.status} /></td><td><Link className="admin-table__action" to={`/admin/orders/${order.id}`}>{order.hasCabinetry && order.status === 'new' ? 'Prepare quote' : 'View'}</Link></td>
    </tr>)}</tbody>
  </table></div>;
}
