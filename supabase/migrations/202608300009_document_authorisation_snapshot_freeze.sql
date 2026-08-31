-- Document authorization must use the authenticated database identity rather
-- than application-supplied identity or role claims. Quote schedules are frozen
-- when a quote is first released as a document, not on every draft edit.

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
  on conflict (quote_id) do nothing;
end;
$$;

-- Version edits may continue until a quote document is first generated. A
-- snapshot row is the immutable release marker, so schedule-save triggers must
-- not create or mutate it.
drop trigger if exists capture_schedule_before_quote_relink on public.payment_plan_instalments;
drop trigger if exists capture_schedule_after_change on public.payment_plan_instalments;

create or replace function public.load_authorised_order_document(
  p_document_type text,
  p_document_id uuid
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
  v_caller_id uuid := auth.uid();
  v_is_admin boolean := current_setting('request.jwt.claim.role', true) = 'service_role' or public.is_admin();
begin
  if p_document_type not in ('quote', 'invoice') or p_document_id is null then
    raise exception 'A document action, type and id are required.';
  end if;
  if not v_is_admin and v_caller_id is null then
    raise exception 'Unauthorised.';
  end if;

  if p_document_type = 'quote' then
    select * into v_quote from public.quotes where id = p_document_id for share;
    if not found then raise exception 'Unable to load the document.'; end if;
    select * into v_order from public.orders where id = v_quote.order_id for share;
    select * into v_customer from public.customers where id = v_order.customer_id for share;
    if not found or (not v_is_admin and v_customer.auth_user_id is distinct from v_caller_id) then
      raise exception 'Unauthorised.';
    end if;

    -- The first authorised document load is the release event. Existing rows
    -- from the previous migration stay frozen and are never overwritten.
    perform public.capture_quote_payment_schedule_snapshot(v_quote.id);
    v_number := coalesce(v_quote.quote_number, (
      select source.quote_number from public.quotes source
      where source.id = coalesce(v_quote.quote_number_source_id, v_quote.id)
    ));
    if v_number is null then v_number := public.ensure_quote_number(v_quote.id); end if;

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
    select * into v_invoice from public.invoices where id = p_document_id and status in ('issued', 'paid') for share;
    if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;
    select * into v_order from public.orders where id = v_invoice.order_id for share;
    select * into v_customer from public.customers where id = v_order.customer_id for share;
    if not found or (not v_is_admin and v_customer.auth_user_id is distinct from v_caller_id) then
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
    from public.site_settings s where s.id = true;
  end if;

  if v_input is null then raise exception 'Unable to load studio details.'; end if;
  return jsonb_build_object(
    'orderId', v_order.id,
    'recipientEmail', case when p_document_type = 'quote' then v_customer.email else v_invoice.customer_email end,
    'customerAuthUserId', v_customer.auth_user_id,
    'input', v_input
  );
end;
$$;

drop function if exists public.load_authorised_order_document(text, uuid, uuid, boolean);
revoke all on function public.load_authorised_order_document(text, uuid) from public;
grant execute on function public.load_authorised_order_document(text, uuid) to authenticated, service_role;