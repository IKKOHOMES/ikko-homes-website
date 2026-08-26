import type { OrderStatus } from '../../types/domain';

const labels: Record<OrderStatus, string> = { new: 'New', reviewing: 'Reviewing', quoted: 'Quoted', invoiced: 'Invoiced', completed: 'Completed' };

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{labels[status]}</span>;
}
