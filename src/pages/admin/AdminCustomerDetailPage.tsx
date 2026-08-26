import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerNoteForm } from '../../components/admin/CustomerNoteForm';
import { addCustomerNote, getCustomer, updateCustomerDiscount, type AdminCustomerDetail } from '../../lib/admin-api';
import { StatusBadge } from '../../components/admin/StatusBadge';

export function AdminCustomerDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [discount, setDiscount] = useState('');
  const [discountMessage, setDiscountMessage] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const load = () => { setLoading(true); getCustomer(id).then((value) => { setDetail(value); setDiscount(value.customer.discountPercent === null ? '' : String(value.customer.discountPercent)); setError(''); }).catch(() => setError('Unable to load customer.')).finally(() => setLoading(false)); };
  useEffect(load, [id]);
  if (loading) return <section className="admin-dashboard"><p className="admin-empty">Loading customer…</p></section>;
  if (!detail || error) return <section className="admin-dashboard"><p className="error" role="alert">{error || 'Unable to load customer.'}</p></section>;
  const saveDiscount = async () => {
    const value = Number(discount);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setDiscountMessage('Enter a discount between 0 and 100%.'); return; }
    setSavingDiscount(true); setDiscountMessage('');
    try {
      await updateCustomerDiscount(id, value);
      setDetail((current) => current ? { ...current, customer: { ...current.customer, discountPercent: value } } : current);
      setDiscountMessage('Discount saved.');
    } catch { setDiscountMessage('Unable to save the customer discount.'); } finally { setSavingDiscount(false); }
  };
  return <section className="admin-dashboard admin-customer-detail"><Link className="admin-back" to="/admin/customers">← Back to customers</Link><div className="admin-page-heading"><div><p className="eyebrow">Customer CRM</p><h1>{detail.customer.name}</h1></div><p>{detail.customer.email}<br />{detail.customer.phone}</p></div><div className="admin-info-grid"><section><h2>Project address</h2><p>{detail.customer.address}</p></section><section><h2>Orders</h2><p>{detail.customer.orderCount}</p></section><section><h2>Latest order</h2><p>{detail.customer.latestOrderAt ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(detail.customer.latestOrderAt)) : '—'}</p></section></div>{detail.customer.accountType === 'registered' ? <section className="admin-detail-section"><h2>Customer discount</h2><label>Customer discount (%)<input aria-label="Customer discount (%)" max="100" min="0" onChange={(event) => setDiscount(event.target.value)} step="0.01" type="number" value={discount} /></label><button className="button" disabled={savingDiscount} onClick={() => void saveDiscount()} type="button">{savingDiscount ? 'Saving…' : 'Save discount'}</button>{discountMessage && <p className={discountMessage === 'Discount saved.' ? 'admin-success' : 'error'} role="alert">{discountMessage}</p>}</section> : <section className="admin-detail-section"><h2>Customer discount</h2><p>—</p></section>}<section className="admin-detail-section"><h2>Order history</h2>{detail.orders.length ? detail.orders.map((order) => <div className="admin-line" key={order.id}><Link to={`/admin/orders/${order.id}`}>{order.number}</Link><StatusBadge status={order.status} /><b>{order.total === null ? 'T.B.D.' : `$${order.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</b></div>) : <p>No orders yet.</p>}</section><section className="admin-detail-section admin-notes"><h2>Internal notes</h2><CustomerNoteForm onAdd={async (body) => { const note = await addCustomerNote(id, body); setDetail((current) => current ? { ...current, notes: [note, ...current.notes] } : current); }} />{detail.notes.length ? <div className="note-list">{detail.notes.map((note) => <article key={note.id}><p>{note.body}</p><small>{new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(note.createdAt))}</small></article>)}</div> : <p>No internal notes yet.</p>}</section></section>;
}
