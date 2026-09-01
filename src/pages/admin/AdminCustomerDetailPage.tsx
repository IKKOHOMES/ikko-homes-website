import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerNoteForm } from '../../components/admin/CustomerNoteForm';
import { addCustomerNote, getCustomer, updateCustomerDiscount, updateCustomerProfile, type AdminCustomerDetail } from '../../lib/admin-api';
import type { OrderStatus } from '../../types/domain';

type CustomerProfileDraft = { firstName: string; lastName: string; email: string; phone: string; address: string };

const formatCurrency = (value: number | null) => value === null ? 'T.B.D.' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const statusLabel = (status: OrderStatus) => ({ new: 'Pending review', reviewing: 'Pending review', quoted: 'Quoted', invoiced: 'Invoiced', completed: 'Completed' }[status]);

function profileDraft(detail: AdminCustomerDetail): CustomerProfileDraft {
  const [firstName = '', ...lastName] = detail.customer.name.split(' ');
  return { firstName, lastName: lastName.join(' '), email: detail.customer.email, phone: detail.customer.phone, address: detail.customer.address };
}

export function AdminCustomerDetailPage() {
  const { id = '' } = useParams();
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [discount, setDiscount] = useState('');
  const [discountMessage, setDiscountMessage] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [profile, setProfile] = useState<CustomerProfileDraft>({ firstName: '', lastName: '', email: '', phone: '', address: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const load = () => {
    setLoading(true);
    getCustomer(id).then((value) => {
      setDetail(value);
      setProfile(profileDraft(value));
      setDiscount(value.customer.discountPercent === null ? '' : String(value.customer.discountPercent));
      setError('');
    }).catch(() => setError('Unable to load customer.')).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const saveDiscount = async () => {
    const value = Number(discount);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setDiscountMessage('Enter a discount between 0 and 100%.'); return; }
    setSavingDiscount(true);
    setDiscountMessage('');
    try {
      await updateCustomerDiscount(id, value);
      setDetail((current) => current ? { ...current, customer: { ...current.customer, discountPercent: value } } : current);
      setDiscountMessage('Discount saved.');
    } catch { setDiscountMessage('Unable to save the customer discount.'); } finally { setSavingDiscount(false); }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage('');
    try {
      await updateCustomerProfile(id, profile);
      setDetail((current) => current ? { ...current, customer: { ...current.customer, name: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim(), email: profile.email.trim(), phone: profile.phone.trim(), address: profile.address.trim() } } : current);
      setProfileMessage('Customer details saved.');
    } catch { setProfileMessage('Unable to save customer details.'); } finally { setSavingProfile(false); }
  };

  if (loading) return <section className="admin-dashboard"><p className="admin-empty">Loading customer…</p></section>;
  if (!detail || error) return <section className="admin-dashboard"><p className="error" role="alert">{error || 'Unable to load customer.'}</p></section>;

  const orderTotal = detail.orders.reduce((sum, order) => sum + (order.total ?? 0), 0);
  return <section className="admin-dashboard admin-customer-detail">
    <Link className="admin-back" to="/admin/customers">← Back to customers</Link>
    <div className="admin-page-heading"><div><p className="eyebrow">Customer CRM</p><h1>{detail.customer.name}</h1></div></div>
    <div className="customer-crm-top-grid">
      <section className="admin-detail-section customer-profile-card">
        <h2>Customer</h2>
        <div className="customer-profile-grid">
          <label>First name<input aria-label="First name" onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))} required value={profile.firstName} /></label>
          <label>Last name<input aria-label="Last name" onChange={(event) => setProfile((current) => ({ ...current, lastName: event.target.value }))} required value={profile.lastName} /></label>
          <label>Email<input aria-label="Email" onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} required type="email" value={profile.email} /></label>
          <label>Phone<input aria-label="Phone" onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} required value={profile.phone} /></label>
          <label className="customer-profile-grid__full">Project address<input aria-label="Project address" onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} required value={profile.address} /></label>
        </div>
        <button className="button" disabled={savingProfile} onClick={() => void saveProfile()} type="button">{savingProfile ? 'Saving…' : 'Save customer details'}</button>
        {profileMessage && <p className={profileMessage === 'Customer details saved.' ? 'admin-success' : 'error'} role="alert">{profileMessage}</p>}
      </section>
      <section className="admin-detail-section admin-notes customer-notes-card">
        <h2>Internal note</h2>
        <CustomerNoteForm onAdd={async (body) => { const note = await addCustomerNote(id, body); setDetail((current) => current ? { ...current, notes: [note, ...current.notes] } : current); }} />
        {detail.notes.length ? <div className="note-list">{detail.notes.map((note) => <article key={note.id}><p>{note.body}</p><small>{new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(note.createdAt))}</small></article>)}</div> : <p className="admin-muted">No internal notes yet.</p>}
      </section>
    {detail.customer.accountType === 'registered' ? <section className="admin-detail-section customer-discount-card"><h2>Customer discount</h2><label>Customer discount (%)<input aria-label="Customer discount (%)" max="100" min="0" onChange={(event) => setDiscount(event.target.value)} step="0.01" type="number" value={discount} /></label><button className="button" disabled={savingDiscount} onClick={() => void saveDiscount()} type="button">{savingDiscount ? 'Saving…' : 'Save discount'}</button>{discountMessage && <p className={discountMessage === 'Discount saved.' ? 'admin-success' : 'error'} role="alert">{discountMessage}</p>}</section> : <section className="admin-detail-section customer-discount-card"><h2>Customer discount</h2><p>—</p></section>}
    </div>
    <section className="customer-orders-section">
      <div className="customer-orders-section__heading"><p className="eyebrow">Orders</p><h2>Customer order overview</h2></div>
      <div className="customer-order-summary"><article><span>Orders</span><b>{detail.customer.orderCount}</b></article><article><span>Order total value</span><b>{formatCurrency(orderTotal)}</b></article><article><span>Latest order</span><b>{formatDate(detail.customer.latestOrderAt)}</b></article></div>
      <section className="admin-detail-section customer-order-history"><h2>Order history</h2>{detail.orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order no.</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>{detail.orders.map((order) => <tr key={order.id}><td><Link className="admin-table__action" to={'/admin/orders/' + order.id}>{order.number}</Link></td><td>{formatDate(order.createdAt)}</td><td>{statusLabel(order.status)}</td><td><b>{formatCurrency(order.total)}</b></td></tr>)}</tbody></table></div> : <p>No orders yet.</p>}</section>
    </section>
  </section>;
}