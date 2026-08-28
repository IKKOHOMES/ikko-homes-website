import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QuoteEditor } from '../../components/admin/QuoteEditor';
import { PaymentPlanEditor } from '../../components/admin/PaymentPlanEditor';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { confirmQuote, getAdminOrder, savePaymentPlan, saveQuote, type AdminOrderDetail } from '../../lib/admin-api';

export function AdminOrderDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); getAdminOrder(id).then((value) => { setDetail(value); setError(''); }).catch(() => setError('Unable to load the order.')).finally(() => setLoading(false)); };
  useEffect(load, [id]);
  if (loading) return <section className="admin-dashboard"><p className="admin-empty">Loading order…</p></section>;
  if (error || !detail) return <section className="admin-dashboard"><p className="error" role="alert">{error || 'Unable to load the order.'}</p></section>;
  const latestQuote = detail.quotes[0];
  return <section className="admin-dashboard admin-order-detail"><Link className="admin-back" to="/admin/orders">← Back to orders</Link><div className="admin-page-heading"><div><p className="eyebrow">Order {detail.order.number}</p><h1>{detail.order.customerName}</h1></div><StatusBadge status={detail.order.status} /></div>
    <div className="admin-info-grid"><section><h2>Customer</h2><p>{detail.customer.email}<br />{detail.customer.phone}<br />{detail.customer.address}</p></section><section><h2>Internal note</h2><p>{detail.internalNote || 'No customer note provided.'}</p></section><section><h2>Order value</h2><p>{detail.order.total === null ? 'T.B.D.' : `$${detail.order.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</p></section></div>
    <section className="admin-detail-section"><h2>Order lines</h2>{detail.lines.map((line) => <div className="admin-line" key={line.id}><span>{line.name}{line.finish ? ` · ${line.finish}` : ''}</span><span>× {line.quantity}</span><b>{line.unitPrice === null ? 'T.B.D.' : `$${line.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</b></div>)}</section>
    {detail.drawings.length > 0 && <section className="admin-detail-section"><h2>Cabinetry drawings</h2>{detail.drawings.map((drawing) => drawing.signedUrl ? <a className="admin-download" href={drawing.signedUrl} key={drawing.fileName} rel="noreferrer" target="_blank">Download {drawing.fileName}</a> : <p key={drawing.fileName}>{drawing.fileName} (link unavailable)</p>)}</section>}
    {latestQuote ? <><QuoteEditor quote={latestQuote} onSave={async (input) => { await saveQuote(input); load(); }} onConfirm={async (quoteId) => { await confirmQuote(detail.order.id, quoteId); load(); }} />{latestQuote.status === 'confirmed' && <PaymentPlanEditor quoteTotal={latestQuote.total} instalments={detail.paymentPlan} onSave={async (instalments) => { await savePaymentPlan(detail.order.id, latestQuote.id, instalments); load(); }} onGenerate={async () => { throw new Error('Invoice generation will be enabled in the next stage.'); }} />}</> : <p className="admin-empty">Quote v1 is being prepared.</p>}
  </section>;
}
