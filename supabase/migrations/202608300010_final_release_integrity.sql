-- Final release-integrity remediation.  Rates and invoice line amounts are GST-exclusive;
-- invoice.total and payment-plan amounts are GST-inclusive.

drop policy if exists "customers read own invoices" on public.invoices;
create policy "customers read issued or paid own invoices" on public.invoices
  for select to authenticated
  using (
    status in ('issued', 'paid')
    and exists (
      select 1 from public.orders o
      where o.id = invoices.order_id and public.is_customer_owner(o.customer_id)
    )
  );

drop policy if exists "customers read own invoice lines" on public.invoice_lines;
create policy "customers read issued or paid own invoice lines" on public.invoice_lines
  for select to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      join public.orders o on o.id = i.order_id
      where i.id = invoice_lines.invoice_id
        and i.status in ('issued', 'paid')
        and public.is_customer_owner(o.customer_id)
    )
  );

-- Migration 008 pre-populated snapshots for every quote. Establish the release
-- marker before cleanup: a download-only snapshot has no delivery row or invoice,
-- so provenance cannot be reconstructed safely. Preserve those snapshots rather
-- than allowing a forward migration to silently change an already-downloaded quote.
alter table public.quotes add column if not exists document_generated_at timestamptz;
alter table public.invoices add column if not exists document_generated_at timestamptz;
update public.quotes q
set document_generated_at = coalesce(q.document_generated_at, s.captured_at)
from public.quote_payment_schedule_snapshots s
where s.quote_id = q.id and q.document_generated_at is null;

-- Cleanup is limited to snapshots that have no release marker. Existing snapshots
-- are conservatively retained when their original release provenance is unknown.
delete from public.quote_payment_schedule_snapshots s
where not exists (
  select 1 from public.quotes q
  where q.id = s.quote_id and q.document_generated_at is not null
) and not exists (
  select 1 from public.order_document_deliveries d
  where d.document_type = 'quote' and d.quote_id = s.quote_id and d.outcome = 'sent'
) and not exists (
  select 1
  from public.payment_plan_instalments p
  join public.invoices i on i.payment_plan_instalment_id = p.id
  where p.quote_id = s.quote_id and i.status in ('issued', 'paid')
);
create or replace function public.ensure_quote_number(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_order_id uuid; v_quote_number text; v_period char(6); v_sequence integer;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' and not public.is_admin() then
    raise exception 'Only administrators can assign quote numbers';
  end if;
  select order_id into v_order_id from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote % does not exist', p_quote_id; end if;
  -- Shared lifecycle order: order before quote-number counter/quote row.
  perform 1 from public.orders where id = v_order_id for update;
  select quote_number, to_char(created_at, 'YYYYMM') into v_quote_number, v_period
  from public.quotes where id = p_quote_id for update;
  if v_quote_number is not null then return v_quote_number; end if;
  insert into public.quote_number_counters (period, last_sequence) values (v_period, 1)
  on conflict (period) do update set last_sequence = public.quote_number_counters.last_sequence + 1
  returning last_sequence into v_sequence;
  update public.quotes set quote_number = 'IKKO' || v_period || lpad(v_sequence::text, 4, '0')
  where id = p_quote_id and quote_number is null returning quote_number into v_quote_number;
  return v_quote_number;
end;
$$;

create or replace function public.confirm_quote(p_order_id uuid, p_quote_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders; v_quote public.quotes; v_subtotal numeric(12,2); v_discount numeric(12,2); v_gst numeric(12,2); v_total numeric(12,2);
begin
  perform public.assert_payment_plan_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Unable to confirm quotation.'; end if;
  select * into v_quote from public.quotes where id = p_quote_id and order_id = p_order_id for update;
  if not found or v_quote.expires_on is null or not exists (select 1 from public.quote_lines where quote_id = p_quote_id)
    or exists (select 1 from public.quote_lines where quote_id = p_quote_id and (is_tbd or length(trim(display_name)) = 0 or unit_price < 0 or quantity <= 0)) then
    raise exception 'Unable to confirm quotation.';
  end if;
  select round(coalesce(sum(round(unit_price * quantity, 2)), 0), 2) into v_subtotal from public.quote_lines where quote_id = p_quote_id;
  v_discount := least(greatest(coalesce(v_quote.discount_total, 0), 0), v_subtotal);
  v_gst := round((v_subtotal - v_discount) * 0.10, 2);
  v_total := v_subtotal - v_discount + v_gst;
  update public.quotes set subtotal = v_subtotal, discount_total = v_discount, gst_total = v_gst, total = v_total,
    status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()) where id = p_quote_id;
  perform public.ensure_quote_number(p_quote_id);
  if v_order.status not in ('invoiced', 'completed') then update public.orders set status = 'quoted' where id = p_order_id; v_order.status := 'quoted'; end if;
  insert into public.order_status_events (order_id, status, note) values (p_order_id, v_order.status, 'Quotation confirmed.');
  return v_order.status;
end;
$$;

create or replace function public.sync_payment_plan_invoice_draft(
  p_order_id uuid, p_order_number text, p_customer_name text, p_customer_email text,
  p_customer_address text, p_instalment_id uuid, p_label text, p_amount numeric, p_due_on date
) returns public.invoices
language plpgsql security definer set search_path = public
as $$
declare v_invoice public.invoices; v_ex_gst numeric(12,2) := round(p_amount / 1.10, 2);
begin
  select * into v_invoice from public.invoices where order_id = p_order_id and payment_plan_instalment_id = p_instalment_id for update;
  if found and v_invoice.status <> 'draft' then raise exception 'Issued instalments cannot be changed.'; end if;
  if found then update public.invoices set customer_name=p_customer_name, customer_email=p_customer_email, customer_address=p_customer_address, total=p_amount, due_on=p_due_on where id=v_invoice.id returning * into v_invoice;
  else insert into public.invoices (invoice_number, order_id, customer_name, customer_email, customer_address, total, status, payment_plan_instalment_id, due_on)
    values (public.reserve_invoice_number(), p_order_id, p_customer_name, p_customer_email, p_customer_address, p_amount, 'draft', p_instalment_id, p_due_on) returning * into v_invoice;
  end if;
  delete from public.invoice_lines where invoice_id = v_invoice.id;
  insert into public.invoice_lines (invoice_id, display_name, unit_price, quantity, finish)
    values (v_invoice.id, p_label || ' — ' || p_order_number, v_ex_gst, 1, null);
  return v_invoice;
end;
$$;

create or replace function public.replace_payment_plan_and_sync_invoices(p_order_id uuid, p_quote_id uuid, p_instalments jsonb)
returns table (id uuid, invoice_number text, instalment_id uuid, status public.invoice_status)
language plpgsql security definer set search_path = public
as $$
declare v_order record; v_quote record; v_input record; v_instalment public.payment_plan_instalments; v_invoice public.invoices;
  v_amount_total numeric := 0; v_percentage_total numeric := 0; v_sequence integer := 0; v_temp_base integer;
begin
  perform public.assert_payment_plan_admin();
  if jsonb_typeof(p_instalments) <> 'array' or jsonb_array_length(p_instalments)=0 then raise exception 'A draft payment plan is required.'; end if;
  perform public.lock_payment_plan_order(p_order_id);
  select o.id, o.order_number, c.first_name || ' ' || c.last_name customer_name, c.email customer_email, c.address customer_address into v_order from public.orders o join public.customers c on c.id=o.customer_id where o.id=p_order_id;
  if not found then raise exception 'Order is required.'; end if;
  select id,total into v_quote from public.quotes where id=p_quote_id and order_id=p_order_id and status='confirmed' for update;
  if not found then raise exception 'A confirmed quote is required.'; end if;
  if exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','') is not null group by lower(e->>'id') having count(*)>1) then raise exception 'Payment plan instalment IDs must be unique.'; end if;
  if exists (select 1 from public.payment_plan_instalments p where p.order_id=p_order_id and p.status<>'draft' and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','')::uuid=p.id)) then raise exception 'Issued or paid instalments cannot be removed.'; end if;
  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text,label text,percentage numeric,amount numeric,"dueOn" date,"internalNote" text) loop
    if coalesce(trim(v_input.label),'')='' or v_input.amount is null or v_input.amount<=0 or v_input.percentage is null or v_input.percentage<=0 or v_input."dueOn" is null then raise exception 'Invalid payment plan instalment.'; end if;
    if abs(round(v_input.percentage,2)-round((round(v_input.amount,2)/round(v_quote.total,2))*100,2)) > 0.01 then raise exception 'Instalment percentage must match its cent-rounded amount.'; end if;
    v_amount_total := v_amount_total + v_input.amount; v_percentage_total := v_percentage_total + v_input.percentage;
  end loop;
  if round(v_amount_total,2)<>round(v_quote.total,2) or abs(round(v_percentage_total,2)-100)>0.01 then raise exception 'Instalments must equal the confirmed quote total.'; end if;
  delete from public.invoices i where i.order_id=p_order_id and i.status='draft' and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','')::uuid=i.payment_plan_instalment_id);
  delete from public.payment_plan_instalments p where p.order_id=p_order_id and p.status='draft' and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','')::uuid=p.id);
  select coalesce(max(sequence),0) + jsonb_array_length(p_instalments) + 1 into v_temp_base from public.payment_plan_instalments where order_id=p_order_id;
  with drafts as (select id, row_number() over (order by id) n from public.payment_plan_instalments where order_id=p_order_id and status='draft')
  update public.payment_plan_instalments p set sequence=v_temp_base+drafts.n from drafts where p.id=drafts.id;
  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text,label text,percentage numeric,amount numeric,"dueOn" date,"internalNote" text) loop
    v_sequence := v_sequence+1;
    if nullif(v_input.id,'') is null then
      insert into public.payment_plan_instalments (order_id,quote_id,sequence,label,percentage,amount,due_on,internal_note,status) values (p_order_id,p_quote_id,v_sequence,trim(v_input.label),round(v_input.percentage,2),round(v_input.amount,2),v_input."dueOn",coalesce(trim(v_input."internalNote"),''),'draft') returning * into v_instalment;
    else
      select * into v_instalment from public.payment_plan_instalments where id=v_input.id::uuid and order_id=p_order_id;
      if not found then raise exception 'Payment plan instalment not found.'; end if;
      if v_instalment.status<>'draft' then
        if v_instalment.sequence<>v_sequence or v_instalment.label is distinct from trim(v_input.label) or v_instalment.percentage is distinct from round(v_input.percentage,2) or v_instalment.amount is distinct from round(v_input.amount,2) or v_instalment.due_on is distinct from v_input."dueOn" or v_instalment.internal_note is distinct from coalesce(trim(v_input."internalNote"),'') then raise exception 'Issued or paid instalments cannot be changed.'; end if;
        select * into v_invoice from public.invoices where payment_plan_instalment_id=v_instalment.id for update;
        if not found or v_invoice.status not in ('issued','paid') then raise exception 'Immutable instalment invoice is unavailable.'; end if;
        id:=v_invoice.id; invoice_number:=v_invoice.invoice_number; instalment_id:=v_instalment.id; status:=v_invoice.status; return next; continue;
      end if;
      update public.payment_plan_instalments set quote_id=p_quote_id,sequence=v_sequence,label=trim(v_input.label),percentage=round(v_input.percentage,2),amount=round(v_input.amount,2),due_on=v_input."dueOn",internal_note=coalesce(trim(v_input."internalNote"),'') where id=v_instalment.id returning * into v_instalment;
    end if;
    v_invoice:=public.sync_payment_plan_invoice_draft(p_order_id,v_order.order_number,v_order.customer_name,v_order.customer_email,v_order.customer_address,v_instalment.id,v_instalment.label,v_instalment.amount,v_instalment.due_on);
    id:=v_invoice.id; invoice_number:=v_invoice.invoice_number; instalment_id:=v_instalment.id; status:='draft'; return next;
  end loop;
end;
$$;

-- Document loads first follow the lifecycle order (order, schedule, document),
-- and quote-number allocation occurs on confirmation, never by a customer download.
drop function if exists public.load_authorised_order_document(text, uuid);
create function public.load_authorised_order_document(p_document_type text, p_document_id uuid, p_studio_abn text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_quote public.quotes; v_invoice public.invoices; v_order public.orders; v_customer public.customers; v_input jsonb; v_subtotal numeric(12,2); v_gst numeric(12,2); v_caller uuid:=auth.uid(); v_admin boolean:=current_setting('request.jwt.claim.role',true)='service_role' or public.is_admin(); v_abn text:=nullif(trim(p_studio_abn),'');
begin
  if p_document_type not in ('quote','invoice') or p_document_id is null then raise exception 'A document action, type and id are required.'; end if;
  if not v_admin and v_caller is null then raise exception 'Unauthorised.'; end if;
  if p_document_type='quote' then
    select * into v_quote from public.quotes where id=p_document_id; if not found then raise exception 'Unable to load the document.'; end if;
    select * into v_order from public.orders where id=v_quote.order_id; select * into v_customer from public.customers where id=v_order.customer_id;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then raise exception 'Unauthorised.'; end if;
    if v_quote.quote_number is null then raise exception 'Quote number is unavailable.'; end if;
    perform 1 from public.orders where id=v_order.id for share;
    perform 1 from public.payment_plan_instalments where order_id=v_order.id order by id for share;
    select * into v_quote from public.quotes where id=p_document_id for share;
    perform public.capture_quote_payment_schedule_snapshot(v_quote.id);
    select jsonb_build_object('documentType','quote','number',v_quote.quote_number,'issuedOn',v_quote.created_at,'expiresOn',v_quote.expires_on,'customer',jsonb_build_object('name',trim(v_customer.first_name || ' ' || v_customer.last_name),'email',v_customer.email,'phone',v_customer.phone,'address',v_customer.address),'studio',jsonb_build_object('address',s.studio_address,'email',s.studio_email,'phone',s.studio_phone,'abn',v_abn),'lines',coalesce((select jsonb_agg(jsonb_build_object('description',ql.display_name,'unitPrice',ql.unit_price,'quantity',ql.quantity,'isTbd',ql.is_tbd) order by ql.id) from public.quote_lines ql where ql.quote_id=v_quote.id),'[]'::jsonb),'subtotal',coalesce(v_quote.subtotal,v_quote.total),'discountTotal',coalesce(v_quote.discount_total,0),'gstTotal',coalesce(v_quote.gst_total,0),'totalDue',v_quote.total,'paymentSchedule',coalesce(snapshot.payment_schedule,'[]'::jsonb)) into v_input from public.site_settings s left join public.quote_payment_schedule_snapshots snapshot on snapshot.quote_id=v_quote.id where s.id=true;
  else
    select * into v_invoice from public.invoices where id=p_document_id; if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;
    select * into v_order from public.orders where id=v_invoice.order_id; select * into v_customer from public.customers where id=v_order.customer_id;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then raise exception 'Unauthorised.'; end if;
    perform 1 from public.orders where id=v_order.id for share;
    perform 1 from public.payment_plan_instalments where order_id=v_order.id order by id for share;
    select * into v_invoice from public.invoices where id=p_document_id and status in ('issued','paid') for share; if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;
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