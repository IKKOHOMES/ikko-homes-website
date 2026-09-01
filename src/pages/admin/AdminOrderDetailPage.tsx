import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentActions } from '../../components/admin/DocumentActions';
import { QuoteEditor } from '../../components/admin/QuoteEditor';
import { PaymentPlanEditor } from '../../components/admin/PaymentPlanEditor';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { confirmQuote, getAdminOrder, markInvoicePaid, savePaymentPlan, saveQuote, type AdminOrderDetail } from '../../lib/admin-api';
import { issueInvoice, synchroniseInvoiceDrafts } from '../../lib/admin-invoice';

function formatOrderDate(value?: string) {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams(); const [detail, setDetail] = useState<AdminOrderDetail | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [invoiceError, setInvoiceError] = useState(''); const [working, setWorking] = useState(false);
  const load = async () => { setLoading(true); try { const value = await getAdminOrder(id); setDetail(value); setError(''); } catch { setError('Unable to load the order.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [id]);
  if (loading) return <section className="admin-dashboard"><p className="admin-empty">Loading order…</p></section>;
  if (error || !detail) return <section className="admin-dashboard"><p className="error" role="alert">{error || 'Unable to load the order.'}</p></section>;
  const latestQuote = detail.quotes[0];
  const syncInvoiceDrafts = async () => { setWorking(true); setInvoiceError(''); try { await synchroniseInvoiceDrafts(detail.order.id); await load(); } catch (reason) { setInvoiceError(reason instanceof Error ? reason.message : 'Unable to synchronise invoice drafts.'); } finally { setWorking(false); } };
  const issue = async (invoiceId: string) => { setWorking(true); setInvoiceError(''); try { await issueInvoice(detail.order.id, invoiceId); await load(); } catch (reason) { setInvoiceError(reason instanceof Error ? reason.message : 'Unable to issue the invoice.'); } finally { setWorking(false); } };
  const markPaid = async (invoiceId: string) => { setWorking(true); setInvoiceError(''); try { await markInvoicePaid(invoiceId, new Date().toISOString(), ''); await load(); } catch { setInvoiceError('Unable to record the payment.'); } finally { setWorking(false); } };

  return <section className="admin-dashboard admin-order-detail">
    <Link className="admin-back" to="/admin/orders">← Back to orders</Link>
    <h1 className="sr-only">Order {detail.order.number}</h1>
    <div className="admin-info-grid admin-order-detail__info-grid">
      <section><h2>Customer</h2><p className="admin-order-detail__customer-name">{detail.order.customerName}</p><p>{detail.customer.email}<br />{detail.customer.phone}<br />{detail.customer.address}</p></section>
      <section><h2>Order notes</h2><p>{detail.internalNote || 'No customer note provided.'}</p></section>
      <section className="admin-order-detail__summary">
        <div><h2>Order no.</h2><p>{detail.order.number}</p></div>
        <div><h2>Date</h2><p>{formatOrderDate(detail.order.createdAt)}</p></div>
        <div><h2>Status</h2><StatusBadge status={detail.order.status} /></div>
      </section>
    </div>
    <section className="admin-detail-section"><h2>Order lines</h2>{detail.lines.map((line) => <div className="admin-line" key={line.id}><span>{line.name}{line.finish ? ` · ${line.finish}` : ''}</span><span>× {line.quantity}</span><b>{line.unitPrice === null ? 'T.B.D.' : `$${line.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</b></div>)}</section>
    {detail.drawings.length > 0 && <section className="admin-detail-section"><h2>Plans</h2>{detail.drawings.map((drawing) => drawing.signedUrl ? <a className="admin-download" href={drawing.signedUrl} key={drawing.fileName} rel="noreferrer" target="_blank">Download {drawing.fileName}</a> : <p key={drawing.fileName}>{drawing.fileName} (link unavailable)</p>)}</section>}
    {latestQuote ? <><section className="admin-detail-section admin-document-section"><div><p className="eyebrow">{latestQuote.quoteNumber ? `Quote ${latestQuote.quoteNumber} · v${latestQuote.version}` : `Quote v${latestQuote.version}`}</p><h2>Quote document</h2></div><DocumentActions disabled={latestQuote.status !== 'confirmed'} documentId={latestQuote.id} documentType="quote" recipientEmail={detail.customer.email} /></section><QuoteEditor quote={latestQuote} onSave={async (input) => { await saveQuote(input); load(); }} onConfirm={async (quoteId) => { await confirmQuote(detail.order.id, quoteId); load(); }} />{latestQuote.status === 'confirmed' && <PaymentPlanEditor quoteTotal={latestQuote.total} instalments={detail.paymentPlan} onSave={async (instalments) => { const persisted = await savePaymentPlan(detail.order.id, latestQuote.id, instalments); void load(); return persisted; }} onSync={syncInvoiceDrafts} />}</> : <p className="admin-empty">Quote v1 is being prepared.</p>}
    {detail.invoices.length > 0 && <section className="admin-detail-section"><h2>Instalment invoices</h2>{detail.invoices.map((invoice) => { const instalment = detail.paymentPlan.find((line) => line.id === invoice.paymentPlanInstalmentId); return <div className="admin-invoice-row" key={invoice.id}><div className="admin-line"><span>{instalment?.label ?? invoice.number}{invoice.dueOn ? ` · due ${invoice.dueOn}` : ''}</span><span className="status-badge">{invoice.status}</span><b>${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</b>{invoice.status === 'draft' && <button className="admin-secondary-button" disabled={working} onClick={() => void issue(invoice.id)} type="button">Issue invoice</button>}{invoice.status === 'issued' && <button className="admin-secondary-button" disabled={working} onClick={() => void markPaid(invoice.id)} type="button">Mark paid</button>}</div>{invoice.status !== 'draft' && <DocumentActions documentId={invoice.id} documentType="invoice" recipientEmail={detail.customer.email} disabled={working} />}</div>; })}{invoiceError && <p className="error" role="alert">{invoiceError}</p>}</section>}
  </section>;
}