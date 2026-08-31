-- Keep each quote PDF tied to the payment schedule that existed for that revision.
create table if not exists public.quote_payment_schedule_snapshots (
  quote_id uuid primary key references public.quotes(id) on delete cascade,
  payment_schedule jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now()
);

create or replace function public.capture_quote_payment_schedule_snapshot(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quote_id is null then
    return;
  end if;

  insert into public.quote_payment_schedule_snapshots (quote_id, payment_schedule, captured_at)
  values (
    p_quote_id,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', p.label,
        'percentage', p.percentage,
        'amount', p.amount,
        'dueOn', p.due_on,
        'status', p.status
      ) order by p.sequence, p.id)
      from public.payment_plan_instalments p
      where p.quote_id = p_quote_id
    ), '[]'::jsonb),
    now()
  )
  on conflict (quote_id) do update
  set payment_schedule = excluded.payment_schedule,
      captured_at = excluded.captured_at;
end;
$$;

-- Snapshot existing current rows once. Earlier mutable data that was already
-- relinked before this forward migration cannot be reconstructed, but all
-- subsequent edits retain the historical revision before that relink occurs.
do $$
declare
  v_quote_id uuid;
begin
  for v_quote_id in select id from public.quotes loop
    perform public.capture_quote_payment_schedule_snapshot(v_quote_id);
  end loop;
end;
$$;

create or replace function public.capture_schedule_before_quote_relink()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.quote_id is distinct from new.quote_id then
    perform public.capture_quote_payment_schedule_snapshot(old.quote_id);
  end if;
  return new;
end;
$$;

create or replace function public.capture_schedule_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.quote_id is not distinct from new.quote_id
    and old.sequence is not distinct from new.sequence
    and old.label is not distinct from new.label
    and old.percentage is not distinct from new.percentage
    and old.amount is not distinct from new.amount
    and old.due_on is not distinct from new.due_on then
    return new;
  end if;

  perform public.capture_quote_payment_schedule_snapshot(
    case when tg_op = 'DELETE' then old.quote_id else new.quote_id end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists capture_schedule_before_quote_relink on public.payment_plan_instalments;
create trigger capture_schedule_before_quote_relink
before update of quote_id on public.payment_plan_instalments
for each row execute procedure public.capture_schedule_before_quote_relink();

drop trigger if exists capture_schedule_after_change on public.payment_plan_instalments;
create trigger capture_schedule_after_change
after insert or update or delete on public.payment_plan_instalments
for each row execute procedure public.capture_schedule_after_change();

create or replace function public.confirm_quote(p_order_id uuid, p_quote_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_quote public.quotes;
begin
  perform public.assert_payment_plan_admin();

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Unable to confirm quotation.';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and order_id = p_order_id
  for update;
  if not found or v_quote.expires_on is null or not exists (select 1 from public.quote_lines where quote_id = p_quote_id) or exists (
    select 1 from public.quote_lines
    where quote_id = p_quote_id
      and (is_tbd or length(trim(display_name)) = 0 or unit_price < 0 or quantity <= 0)
  ) then
    raise exception 'Unable to confirm quotation.';
  end if;

  update public.quotes
  set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now())
  where id = p_quote_id;

  if v_order.status not in ('invoiced', 'completed') then
    update public.orders set status = 'quoted' where id = p_order_id;
    v_order.status := 'quoted';
  end if;

  insert into public.order_status_events (order_id, status, note)
  values (p_order_id, v_order.status, 'Quotation confirmed.');
  return v_order.status;
end;
$$;

-- The final document payload is read in the same database transaction that
-- verifies its caller and invoice lifecycle. The Edge Function never performs
-- an authorise-then-reload sequence against mutable document rows.
create or replace function public.load_authorised_order_document(
  p_document_type text,
  p_document_id uuid,
  p_caller_id uuid,
  p_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_invoice public.invoices;
  v_order public.orders;
  v_customer public.customers;
  v_number text;
  v_input jsonb;
begin
  if p_document_type not in ('quote', 'invoice') or p_document_id is null then
    raise exception 'A document action, type and id are required.';
  end if;

  if p_document_type = 'quote' then
    select * into v_quote from public.quotes where id = p_document_id for share;
    if not found then raise exception 'Unable to load the document.'; end if;
    select * into v_order from public.orders where id = v_quote.order_id for share;
    select * into v_customer from public.customers where id = v_order.customer_id for share;
    if not found or (not p_is_admin and v_customer.auth_user_id is distinct from p_caller_id) then
      raise exception 'Unauthorised.';
    end if;

    v_number := coalesce(v_quote.quote_number, (
      select source.quote_number from public.quotes source
      where source.id = coalesce(v_quote.quote_number_source_id, v_quote.id)
    ));
    if v_number is null then
      v_number := public.ensure_quote_number(v_quote.id);
    end if;

    select jsonb_build_object(
      'documentType', 'quote', 'number', v_number,
      'issuedOn', v_quote.created_at, 'expiresOn', v_quote.expires_on,
      'customer', jsonb_build_object('name', trim(v_customer.first_name || ' ' || v_customer.last_name), 'email', v_customer.email, 'phone', v_customer.phone, 'address', v_customer.address),
      'studio', jsonb_build_object('address', s.studio_address, 'email', s.studio_email, 'phone', s.studio_phone, 'abn', null),
      'lines', coalesce((select jsonb_agg(jsonb_build_object('description', ql.display_name, 'unitPrice', ql.unit_price, 'quantity', ql.quantity, 'isTbd', ql.is_tbd) order by ql.id) from public.quote_lines ql where ql.quote_id = v_quote.id), '[]'::jsonb),
      'subtotal', coalesce(v_quote.subtotal, v_quote.total), 'discountTotal', coalesce(v_quote.discount_total, 0), 'gstTotal', coalesce(v_quote.gst_total, 0), 'totalDue', v_quote.total,
      'paymentSchedule', coalesce(snapshot.payment_schedule, '[]'::jsonb)
    ) into v_input
    from public.site_settings s
    left join public.quote_payment_schedule_snapshots snapshot on snapshot.quote_id = v_quote.id
    where s.id = true;
  else
    select * into v_invoice
    from public.invoices
    where id = p_document_id and status in ('issued', 'paid')
    for share;
    if not found then
      raise exception 'Only issued or paid invoices can be downloaded or emailed.';
    end if;
    select * into v_order from public.orders where id = v_invoice.order_id for share;
    select * into v_customer from public.customers where id = v_order.customer_id for share;
    if not found or (not p_is_admin and v_customer.auth_user_id is distinct from p_caller_id) then
      raise exception 'Unauthorised.';
    end if;

    select jsonb_build_object(
      'documentType', 'invoice', 'number', v_invoice.invoice_number,
      'issuedOn', coalesce(v_invoice.issued_at, v_invoice.created_at), 'dueOn', v_invoice.due_on, 'invoiceStatus', v_invoice.status,
      'customer', jsonb_build_object('name', v_invoice.customer_name, 'email', v_invoice.customer_email, 'phone', v_customer.phone, 'address', v_invoice.customer_address),
      'studio', jsonb_build_object('address', s.studio_address, 'email', s.studio_email, 'phone', s.studio_phone, 'abn', null),
      'lines', coalesce((select jsonb_agg(jsonb_build_object('description', il.display_name, 'unitPrice', il.unit_price, 'quantity', il.quantity, 'finish', il.finish) order by il.id) from public.invoice_lines il where il.invoice_id = v_invoice.id), '[]'::jsonb),
      'subtotal', v_invoice.total / 1.1, 'discountTotal', 0, 'gstTotal', v_invoice.total / 11, 'totalDue', v_invoice.total,
      'invoiceMilestone', (select jsonb_build_object('description', p.label, 'percentage', p.percentage, 'amount', p.amount, 'dueOn', p.due_on, 'status', p.status) from public.payment_plan_instalments p where p.id = v_invoice.payment_plan_instalment_id)
    ) into v_input
    from public.site_settings s
    where s.id = true;
  end if;

  if v_input is null then
    raise exception 'Unable to load studio details.';
  end if;
  return jsonb_build_object(
    'orderId', v_order.id,
    'recipientEmail', case when p_document_type = 'quote' then v_customer.email else v_invoice.customer_email end,
    'customerAuthUserId', v_customer.auth_user_id,
    'input', v_input
  );
end;
$$;

revoke all on function public.capture_quote_payment_schedule_snapshot(uuid) from public;
revoke all on function public.confirm_quote(uuid, uuid) from public;
revoke all on function public.load_authorised_order_document(text, uuid, uuid, boolean) from public;
grant execute on function public.confirm_quote(uuid, uuid) to authenticated, service_role;
grant execute on function public.load_authorised_order_document(text, uuid, uuid, boolean) to authenticated, service_role;