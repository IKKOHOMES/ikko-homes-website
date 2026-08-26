import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { getCustomerSupabaseClient } from '../lib/supabase';

type AccountOrder = { id: string; order_number: string; status: string; created_at: string; discount_percent: number | string; furniture_discount_total: number | string; order_lines: Array<{ unit_price: number | string | null; quantity: number; line_kind: 'furniture' | 'cabinetry' }>; invoices: Array<{ id: string; invoice_number: string; total: number | string }> };
type AccountCustomer = { first_name: string; email: string; discount_percent: number | string; orders: AccountOrder[] };

export function CustomerAccountPage() {
  const { user, signOut } = useCustomerAuth();
  const [customer, setCustomer] = useState<AccountCustomer | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let active = true;
    void getCustomerSupabaseClient().from('customers').select('first_name, email, discount_percent, orders(id, order_number, status, created_at, discount_percent, furniture_discount_total, order_lines(unit_price, quantity, line_kind), invoices(id, invoice_number, total))').eq('auth_user_id', user.id).maybeSingle().then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError('Unable to load your account right now.');
      else setCustomer(data as unknown as AccountCustomer | null);
    });
    return () => { active = false; };
  }, [user?.id]);
  if (!user) return null;
  const orders = [...(customer?.orders ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return <section className="content-section customer-account"><div className="customer-account__heading"><div><p className="eyebrow">IKKO Homes account</p><h1>My orders</h1><p>{customer ? `Welcome, ${customer.first_name}.` : user.email}</p></div><button className="text-button" onClick={() => void signOut()} type="button">Sign out</button></div>{customer && <p className="customer-account__discount">Your furniture discount: {Number(customer.discount_percent)}%</p>}{error && <p className="error" role="alert">{error}</p>}<div className="customer-account__orders">{!error && !orders.length && <p>No orders yet.</p>}{orders.map((order) => { const hasCabinetry = order.order_lines.some((line) => line.line_kind === 'cabinetry'); const furnitureTotal = order.order_lines.reduce((total, line) => total + (line.unit_price === null ? 0 : Number(line.unit_price) * line.quantity), 0); const invoice = order.invoices[0]; return <article key={order.id}><div><b>{order.order_number}</b><span>{new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(order.created_at))}</span></div><span className="status-badge">{order.status}</span><p>{invoice ? <Link to={`/account/invoices/${invoice.id}`}>Invoice {invoice.invoice_number} · ${Number(invoice.total).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</Link> : hasCabinetry ? 'Cabinetry quotation: T.B.D.' : `$${furnitureTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}</p><small>Furniture discount locked at {Number(order.discount_percent)}% · Saved ${Number(order.furniture_discount_total).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</small></article>;})}</div></section>;
}
