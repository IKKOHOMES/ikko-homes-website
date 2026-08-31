-- Compatibility repairs: source-aware quote numbers, confirmed-only document release,
-- draft invoice tax normalisation, and retained released schedule snapshots.
alter table public.quotes add column if not exists document_generated_at timestamptz;
alter table public.invoices add column if not exists document_generated_at timestamptz;

-- Every surviving legacy snapshot represents a release record retained by the prior
-- migration; mark it so any later cleanup cannot treat it as an unreleased draft.
update public.quotes q
set document_generated_at = coalesce(q.document_generated_at, s.captured_at)
from public.quote_payment_schedule_snapshots s
where s.quote_id = q.id;

-- Legacy draft plan invoices were once stored with GST-inclusive line amounts.
-- Replace their mutable line representation with one canonical GST-exclusive line
-- so subtotal + GST always equals the inclusive invoice total before issue.
with first_lines as (
  select distinct on (il.invoice_id) il.id, il.invoice_id
  from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.status = 'draft'
  order by il.invoice_id, il.id
)
update public.invoice_lines il
set unit_price = round(i.total / 1.10, 2), quantity = 1
from first_lines first_line
join public.invoices i on i.id = first_line.invoice_id
where il.id = first_line.id;

delete from public.invoice_lines il
using public.invoices i
where i.id = il.invoice_id and i.status = 'draft'
  and il.id <> (
    select first_line.id from public.invoice_lines first_line
    where first_line.invoice_id = i.id
    order by first_line.id
    limit 1
  );

insert into public.invoice_lines (invoice_id, display_name, unit_price, quantity, finish)
select i.id, 'Invoice amount (GST exclusive)', round(i.total / 1.10, 2), 1, null
from public.invoices i
where i.status = 'draft'
  and not exists (select 1 from public.invoice_lines il where il.invoice_id = i.id);

create or replace function public.ensure_quote_number(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_source public.quotes;
  v_period char(6);
  v_sequence integer;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' and not public.is_admin() then
    raise exception 'Only administrators can assign quote numbers';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote % does not exist', p_quote_id; end if;
  perform 1 from public.orders where id = v_quote.order_id for update;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.status <> 'confirmed' then raise exception 'Only confirmed quotes can receive a quote number.'; end if;
  select * into v_source from public.quotes
    where id = coalesce(v_quote.quote_number_source_id, v_quote.id) for update;
  if not found or v_source.order_id <> v_quote.order_id or v_source.status <> 'confirmed' then
    raise exception 'A confirmed quote number source is required.';
  end if;
  if v_source.quote_number is not null then return v_source.quote_number; end if;
  v_period := to_char(v_source.created_at, 'YYYYMM');
  insert into public.quote_number_counters (period, last_sequence) values (v_period, 1)
  on conflict (period) do update set last_sequence = public.quote_number_counters.last_sequence + 1
  returning last_sequence into v_sequence;
  update public.quotes
  set quote_number = 'IKKO' || v_period || lpad(v_sequence::text, 4, '0')
  where id = v_source.id and quote_number is null
  returning quote_number into v_source.quote_number;
  return v_source.quote_number;
end;
$$;

create or replace function public.issue_payment_plan_invoice(p_order_id uuid, p_invoice_id uuid)
returns table (id uuid, invoice_number text, instalment_id uuid, status public.invoice_status)
language plpgsql security definer set search_path = public
as $$
declare v_invoice public.invoices; v_instalment public.payment_plan_instalments; v_subtotal numeric(12,2);
begin
  perform public.assert_payment_plan_admin();
  perform public.lock_payment_plan_order(p_order_id);
  select * into v_invoice from public.invoices where id = p_invoice_id and order_id = p_order_id for update;
  if not found or v_invoice.payment_plan_instalment_id is null then raise exception 'A draft invoice for this order is required.'; end if;
  select * into v_instalment from public.payment_plan_instalments where id = v_invoice.payment_plan_instalment_id and order_id = p_order_id for update;
  if not found then raise exception 'A draft invoice for this order is required.'; end if;
  if v_invoice.status = 'issued' and v_instalment.status = 'issued' then
    id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'issued'; return next; return;
  end if;
  if v_invoice.status <> 'draft' or v_instalment.status <> 'draft' then raise exception 'A draft invoice for this order is required.'; end if;
  select round(coalesce(sum(round(unit_price * quantity, 2)), 0), 2) into v_subtotal from public.invoice_lines where invoice_id = v_invoice.id;
  if v_subtotal <> round(v_invoice.total / 1.10, 2) then raise exception 'Draft invoice lines must be GST-exclusive before issue.'; end if;
  update public.invoices set status = 'issued' where id = v_invoice.id;
  update public.payment_plan_instalments set status = 'issued' where id = v_instalment.id;
  update public.orders set status = 'invoiced' where id = p_order_id and status = 'quoted';
  insert into public.order_status_events (order_id, status, note) values (p_order_id, 'invoiced', 'Invoice ' || v_invoice.invoice_number || ' issued.');
  id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'issued'; return next;
end;
$$;

drop function if exists public.load_authorised_order_document(text, uuid, text);
create function public.load_authorised_order_document(p_document_type text, p_document_id uuid, p_studio_abn text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_quote public.quotes; v_source public.quotes; v_invoice public.invoices; v_order public.orders; v_customer public.customers; v_input jsonb; v_subtotal numeric(12,2); v_gst numeric(12,2); v_caller uuid:=auth.uid(); v_admin boolean:=current_setting('request.jwt.claim.role',true)='service_role' or public.is_admin(); v_abn text:=nullif(trim(p_studio_abn),'');
begin
  if p_document_type not in ('quote','invoice') or p_document_id is null then raise exception 'A document action, type and id are required.'; end if;
  if not v_admin and v_caller is null then raise exception 'Unauthorised.'; end if;
  if p_document_type='quote' then
    select * into v_quote from public.quotes where id=p_document_id; if not found then raise exception 'Unable to load the document.'; end if;
    select * into v_order from public.orders where id=v_quote.order_id; select * into v_customer from public.customers where id=v_order.customer_id;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then raise exception 'Unauthorised.'; end if;
    perform 1 from public.orders where id=v_order.id for share;
    perform 1 from public.payment_plan_instalments where order_id=v_order.id order by id for share;
    select * into v_quote from public.quotes where id=p_document_id and status='confirmed' for share;
    if not found then raise exception 'Only confirmed quotes can be downloaded or emailed.'; end if;
    select * into v_source from public.quotes where id=coalesce(v_quote.quote_number_source_id,v_quote.id) for share;
    if not found or v_source.quote_number is null then
      perform public.ensure_quote_number(v_quote.id);
      select * into v_source from public.quotes where id=coalesce(v_quote.quote_number_source_id,v_quote.id) for share;
    end if;
    perform public.capture_quote_payment_schedule_snapshot(v_quote.id);
    update public.quotes set document_generated_at=coalesce(document_generated_at,now()) where id=v_quote.id;
    select jsonb_build_object('documentType','quote','number',v_source.quote_number,'issuedOn',v_quote.created_at,'expiresOn',v_quote.expires_on,'customer',jsonb_build_object('name',trim(v_customer.first_name || ' ' || v_customer.last_name),'email',v_customer.email,'phone',v_customer.phone,'address',v_customer.address),'studio',jsonb_build_object('address',s.studio_address,'email',s.studio_email,'phone',s.studio_phone,'abn',v_abn),'lines',coalesce((select jsonb_agg(jsonb_build_object('description',ql.display_name,'unitPrice',ql.unit_price,'quantity',ql.quantity,'isTbd',ql.is_tbd) order by ql.id) from public.quote_lines ql where ql.quote_id=v_quote.id),'[]'::jsonb),'subtotal',coalesce(v_quote.subtotal,v_quote.total),'discountTotal',coalesce(v_quote.discount_total,0),'gstTotal',coalesce(v_quote.gst_total,0),'totalDue',v_quote.total,'paymentSchedule',coalesce(snapshot.payment_schedule,'[]'::jsonb)) into v_input from public.site_settings s left join public.quote_payment_schedule_snapshots snapshot on snapshot.quote_id=v_quote.id where s.id=true;
  else
    select * into v_invoice from public.invoices where id=p_document_id; if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;
    select * into v_order from public.orders where id=v_invoice.order_id; select * into v_customer from public.customers where id=v_order.customer_id;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then raise exception 'Unauthorised.'; end if;
    perform 1 from public.orders where id=v_order.id for share;
    perform 1 from public.payment_plan_instalments where order_id=v_order.id order by id for share;
    select * into v_invoice from public.invoices where id=p_document_id and status in ('issued','paid') for share; if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;
    update public.invoices set document_generated_at=coalesce(document_generated_at,now()) where id=v_invoice.id;
    select round(coalesce(sum(round(unit_price*quantity,2)),0),2) into v_subtotal from public.invoice_lines where invoice_id=v_invoice.id;
    v_gst:=round(v_invoice.total-v_subtotal,2);
    select jsonb_build_object('documentType','invoice','number',v_invoice.invoice_number,'issuedOn',coalesce(v_invoice.issued_at,v_invoice.created_at),'dueOn',v_invoice.due_on,'invoiceStatus',v_invoice.status,'customer',jsonb_build_object('name',v_invoice.customer_name,'email',v_invoice.customer_email,'phone',v_customer.phone,'address',v_invoice.customer_address),'studio',jsonb_build_object('address',s.studio_address,'email',s.studio_email,'phone',s.studio_phone,'abn',v_abn),'lines',coalesce((select jsonb_agg(jsonb_build_object('description',il.display_name,'unitPrice',il.unit_price,'quantity',il.quantity,'finish',il.finish) order by il.id) from public.invoice_lines il where il.invoice_id=v_invoice.id),'[]'::jsonb),'subtotal',v_subtotal,'discountTotal',0,'gstTotal',v_gst,'totalDue',v_invoice.total,'invoiceMilestone',(select jsonb_build_object('description',p.label,'percentage',p.percentage,'amount',p.amount,'dueOn',p.due_on,'status',p.status) from public.payment_plan_instalments p where p.id=v_invoice.payment_plan_instalment_id)) into v_input from public.site_settings s where s.id=true;
  end if;
  if v_input is null then raise exception 'Unable to load studio details.'; end if;
  return jsonb_build_object('orderId',v_order.id,'recipientEmail',case when p_document_type='quote' then v_customer.email else v_invoice.customer_email end,'customerAuthUserId',v_customer.auth_user_id,'input',v_input);
end;
$$;
revoke all on function public.load_authorised_order_document(text,uuid,text) from public;
grant execute on function public.load_authorised_order_document(text,uuid,text) to authenticated,service_role;