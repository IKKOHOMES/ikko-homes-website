import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { getCustomerSupabaseClient } from '../lib/supabase';

type InvoiceLine = { id: string; display_name: string; unit_price: number | string; quantity: number; finish: string | null };
type CustomerInvoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  total: number | string;
  status: string;
  created_at: string;
  invoice_lines: InvoiceLine[];
  orders: { order_number: string; discount_percent: number | string; furniture_discount_total: number | string } | null;
};

const currency = (value: number | string) => `$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CustomerInvoicePage() {
  const { invoiceId } = useParams();
  const { loading, user } = useCustomerAuth();
  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !invoiceId) return;
    let active = true;
    void getCustomerSupabaseClient().from('invoices')
      .select('id, invoice_number, customer_name, customer_email, customer_address, total, status, created_at, invoice_lines(id, display_name, unit_price, quantity, finish), orders(order_number, discount_percent, furniture_discount_total)')
      .eq('id', invoiceId).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError('Unable to load this invoice right now.');
        else if (!data) setError('This invoice is unavailable.');
        else setInvoice(data as unknown as CustomerInvoice);
      });
    return () => { active = false; };
  }, [invoiceId, user?.id]);

  if (loading) return <section className="content-section editorial"><p>Loading your account…</p></section>;
  if (!user) return <Navigate replace to="/account" />;

  return <section className="content-section customer-invoice">
    <div className="customer-invoice__toolbar no-print"><Link className="text-button" to="/account">← My orders</Link><button className="button" onClick={() => window.print()} type="button">Print / Save as PDF</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {!error && !invoice && <p>Loading invoice…</p>}
    {invoice && <article className="customer-invoice__sheet">
      <header><div><p className="eyebrow">IKKO Homes</p><h1>Invoice</h1></div><div><b>{invoice.invoice_number}</b><span>Issued {new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(invoice.created_at))}</span><span className="status-badge">{invoice.status}</span></div></header>
      <section className="customer-invoice__address"><div><p className="eyebrow">Bill to</p><b>{invoice.customer_name}</b><span>{invoice.customer_email}</span><span>{invoice.customer_address}</span></div><div><p className="eyebrow">Order</p><b>{invoice.orders?.order_number ?? '—'}</b><span>Furniture discount locked at {Number(invoice.orders?.discount_percent ?? 0)}%</span></div></section>
      <div className="customer-invoice__lines"><div className="customer-invoice__line customer-invoice__line--head"><span>Item</span><span>Qty</span><span>Total</span></div>{invoice.invoice_lines.map((line) => <div className="customer-invoice__line" key={line.id}><span><b>{line.display_name}</b>{line.finish && <small>{line.finish}</small>}</span><span>{line.quantity}</span><span>{currency(Number(line.unit_price) * line.quantity)}</span></div>)}</div>
      <footer><span>Furniture discount saved: {currency(invoice.orders?.furniture_discount_total ?? 0)}</span><b>Total {currency(invoice.total)}</b></footer>
    </article>}
  </section>;
}
