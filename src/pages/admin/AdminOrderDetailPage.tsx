import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QuoteForm } from '../../components/admin/QuoteForm';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { getAdminOrder, saveQuote, type AdminOrderDetail } from '../../lib/admin-api';
import { issueInvoice } from '../../lib/admin-invoice';

export function AdminOrderDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState('');
  const [issuing, setIssuing] = useState(false);
  const load = () => { setLoading(true); getAdminOrder(id).then((value) => { setDetail(value); setError(''); }).catch(() => setError('Unable to load the order.')).finally(() => setLoading(false)); };
  useEffect(load, [id]);
  if (loading) return <section className="admin-dashboard"><p className="admin-empty">Loading order…</p></section>;
  if (error || !detail) return <section className="admin-dashboard"><p className="error" role="alert">{error || 'Unable to load the order.'}</p></section>;
  const latestQuote = detail.quotes[0];
  return <section className="admin-dashboard admin-order-detail"><Link className="admin-back" to="/admin/orders">← Back to orders</Link><div className="admin-page-heading"><div><p className="eyebrow">Order {detail.order.number}</p><h1>{detail.order.customerName}</h1></div><StatusBadge status={detail.order.status} /></div>
    <div className="admin-info-grid"><section><h2>Customer</h2><p>{detail.customer.email}<br />{detail.customer.phone}<br />{detail.customer.address}</p></section><section><h2>Internal note</h2><p>{detail.internalNote || 'No customer note provided.'}</p></section><section><h2>Order value</h2><p>{detail.order.total === null ? 'T.B.D.' : `$${detail.order.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</p></section></div>
    <section className="admin-detail-section"><h2>Order lines</h2>{detail.lines.map((line) => <div className="admin-line" key={line.id}><span>{line.name}{line.finish ? ` · ${line.finish}` : ''}</span><span>× {line.quantity}</span><b>{line.unitPrice === null ? 'T.B.D.' : `$${line.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</b></div>)}</section>
    {detail.drawings.length > 0 && <section className="admin-detail-section"><h2>Cabinetry drawings</h2>{detail.drawings.map((drawing) => drawing.signedUrl ? <a className="admin-download" href={drawing.signedUrl} key={drawing.fileName} rel="noreferrer" target="_blank">Download {drawing.fileName}</a> : <p key={drawing.fileName}>{drawing.fileName} (link unavailable)</p>)}</section>}
    {latestQuote && <section className="admin-detail-section"><h2>Latest quotation</h2><p>Version {latestQuote.version} · ${latestQuote.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })} · expires {latestQuote.expiresOn}</p>{detail.order.status === 'quoted' && <><button className="button" disabled={issuing} onClick={async () => { setIssuing(true); setInvoiceError(''); try { await issueInvoice(detail.order.id); load(); } catch { setInvoiceError('Unable to issue the invoice.'); } finally { setIssuing(false); } }} type="button">{issuing ? 'Issuing…' : 'Issue invoice'}</button>{invoiceError && <p className="error" role="alert">{invoiceError}</p>}</>}</section>}
    {detail.order.hasCabinetry && detail.order.invoiceStatus === null && <QuoteForm orderId={detail.order.id} onSave={async (input) => { await saveQuote(input); load(); }} />}
  </section>;
}
