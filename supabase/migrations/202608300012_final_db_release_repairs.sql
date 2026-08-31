-- Forward hardening for the final quote-payment-schedule release.  Migrations
-- 008-011 ran together and treated every pre-existing snapshot as a release;
-- retain only release evidence that can still be demonstrated.

alter table public.quote_number_counters enable row level security;
alter table public.quote_payment_schedule_snapshots enable row level security;

revoke all on table public.quote_number_counters from public, anon, authenticated;
revoke all on table public.quote_payment_schedule_snapshots from public, anon, authenticated;
-- Edge/service maintenance may read an already-released schedule, but only the
-- SECURITY DEFINER capture function writes it. Quote counters are function-only.
grant select on table public.quote_payment_schedule_snapshots to service_role;

-- A marker created solely by migrations 008-011 is not release evidence. Keep
-- snapshot rows only when a sent document or an issued/paid invoice still
-- demonstrates the historical release; clear the matching false marker too.
with evidenced_quotes as (
  select distinct s.quote_id
  from public.quote_payment_schedule_snapshots s
  where exists (
    select 1
    from public.order_document_deliveries d
    where d.document_type = 'quote'
      and d.quote_id = s.quote_id
      and d.outcome = 'sent'
      and d.sent_at is not null
  )
  or exists (
    select 1
    from public.payment_plan_instalments p
    join public.invoices i on i.payment_plan_instalment_id = p.id
    where p.quote_id = s.quote_id
      and i.status in ('issued', 'paid')
  )
)
update public.quotes q
set document_generated_at = null
where q.document_generated_at is not null
  and not exists (select 1 from evidenced_quotes e where e.quote_id = q.id);

delete from public.quote_payment_schedule_snapshots s
where not exists (
  select 1
  from public.order_document_deliveries d
  where d.document_type = 'quote'
    and d.quote_id = s.quote_id
    and d.outcome = 'sent'
    and d.sent_at is not null
)
and not exists (
  select 1
  from public.payment_plan_instalments p
  join public.invoices i on i.payment_plan_instalment_id = p.id
  where p.quote_id = s.quote_id
    and i.status in ('issued', 'paid')
);

-- Snapshot a revision as it existed at release: immutable milestones from this
-- or earlier revisions of the same order, plus drafts owned by this revision.
-- In particular, a newer revision's drafts can never appear in an earlier PDF.
create or replace function public.capture_quote_payment_schedule_snapshot(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
begin
  if p_quote_id is null then
    return;
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id;
  if not found then
    return;
  end if;

  insert into public.quote_payment_schedule_snapshots (quote_id, payment_schedule, captured_at)
  values (
    v_quote.id,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', p.label,
        'percentage', p.percentage,
        'amount', p.amount,
        'dueOn', p.due_on,
        'status', p.status
      ) order by p.sequence, p.id)
      from public.payment_plan_instalments p
      join public.quotes p_quote on p_quote.id = p.quote_id
      where p.order_id = v_quote.order_id
        and p_quote.order_id = v_quote.order_id
        and (
          (p.quote_id = v_quote.id and p.status = 'draft')
          or (
            p.status in ('issued', 'paid', 'overdue')
            and p_quote.version <= v_quote.version
          )
        )
    ), '[]'::jsonb),
    now()
  )
  on conflict (quote_id) do nothing;
end;
$$;

-- Document generation takes the same exclusive prefix used by payment-plan
-- lifecycle mutations: order, schedule in stable id order, then final document.
-- The final quote/invoice is locked FOR UPDATE from the outset, avoiding two
-- readers attempting a FOR SHARE to FOR UPDATE upgrade.
create or replace function public.load_authorised_order_document(
  p_document_type text,
  p_document_id uuid,
  p_studio_abn text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_source public.quotes;
  v_invoice public.invoices;
  v_order public.orders;
  v_customer public.customers;
  v_input jsonb;
  v_subtotal numeric(12,2);
  v_gst numeric(12,2);
  v_caller uuid := auth.uid();
  v_admin boolean := current_setting('request.jwt.claim.role', true) = 'service_role' or public.is_admin();
  v_abn text := nullif(trim(p_studio_abn), '');
begin
  if p_document_type not in ('quote', 'invoice') or p_document_id is null then
    raise exception 'A document action, type and id are required.';
  end if;
  if not v_admin and v_caller is null then
    raise exception 'Unauthorised.';
  end if;

  if p_document_type = 'quote' then
    -- Read only enough to establish ownership before acquiring the common lock
    -- prefix. Re-read the final quote after the prefix is held.
    select * into v_quote from public.quotes where id = p_document_id;
    if not found then raise exception 'Unable to load the document.'; end if;
    select * into v_order from public.orders where id = v_quote.order_id;
    select * into v_customer from public.customers where id = v_order.customer_id;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then
      raise exception 'Unauthorised.';
    end if;

    select * into v_order
    from public.orders
    where id = v_quote.order_id
    for update;
    if not found then raise exception 'Unable to load the document.'; end if;
    select * into v_customer
    from public.customers
    where id = v_order.customer_id
    for update;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then
      raise exception 'Unauthorised.';
    end if;
    perform 1 from public.payment_plan_instalments
      where order_id = v_order.id
      order by id
      for update;
    select * into v_quote
    from public.quotes
    where id = p_document_id
      and order_id = v_order.id
      and status = 'confirmed'
    for update;
    if not found then raise exception 'Only confirmed quotes can be downloaded or emailed.'; end if;

    select * into v_source
    from public.quotes
    where id = coalesce(v_quote.quote_number_source_id, v_quote.id)
    for update;
    if not found then raise exception 'Quote number is unavailable.'; end if;
    if v_source.quote_number is null then
      perform public.ensure_quote_number(v_quote.id);
      select * into v_source
      from public.quotes
      where id = coalesce(v_quote.quote_number_source_id, v_quote.id)
      for update;
    end if;
    if v_source.quote_number is null then raise exception 'Quote number is unavailable.'; end if;

    perform public.capture_quote_payment_schedule_snapshot(v_quote.id);
    update public.quotes
    set document_generated_at = coalesce(document_generated_at, now())
    where id = v_quote.id;

    select jsonb_build_object(
      'documentType', 'quote', 'number', v_source.quote_number,
      'issuedOn', v_quote.created_at, 'expiresOn', v_quote.expires_on,
      'customer', jsonb_build_object('name', trim(v_customer.first_name || ' ' || v_customer.last_name), 'email', v_customer.email, 'phone', v_customer.phone, 'address', v_customer.address),
      'studio', jsonb_build_object('address', s.studio_address, 'email', s.studio_email, 'phone', s.studio_phone, 'abn', v_abn),
      'lines', coalesce((select jsonb_agg(jsonb_build_object('description', ql.display_name, 'unitPrice', ql.unit_price, 'quantity', ql.quantity, 'isTbd', ql.is_tbd) order by ql.id) from public.quote_lines ql where ql.quote_id = v_quote.id), '[]'::jsonb),
      'subtotal', coalesce(v_quote.subtotal, v_quote.total), 'discountTotal', coalesce(v_quote.discount_total, 0), 'gstTotal', coalesce(v_quote.gst_total, 0), 'totalDue', v_quote.total,
      'paymentSchedule', coalesce(snapshot.payment_schedule, '[]'::jsonb)
    ) into v_input
    from public.site_settings s
    left join public.quote_payment_schedule_snapshots snapshot on snapshot.quote_id = v_quote.id
    where s.id = true;
  else
    select * into v_invoice from public.invoices where id = p_document_id;
    if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;
    select * into v_order from public.orders where id = v_invoice.order_id;
    select * into v_customer from public.customers where id = v_order.customer_id;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then
      raise exception 'Unauthorised.';
    end if;

    select * into v_order
    from public.orders
    where id = v_invoice.order_id
    for update;
    if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;
    select * into v_customer
    from public.customers
    where id = v_order.customer_id
    for update;
    if not found or (not v_admin and v_customer.auth_user_id is distinct from v_caller) then
      raise exception 'Unauthorised.';
    end if;
    perform 1 from public.payment_plan_instalments
      where order_id = v_order.id
      order by id
      for update;
    select * into v_invoice
    from public.invoices
    where id = p_document_id
      and order_id = v_order.id
      and status in ('issued', 'paid')
    for update;
    if not found then raise exception 'Only issued or paid invoices can be downloaded or emailed.'; end if;

    update public.invoices
    set document_generated_at = coalesce(document_generated_at, now())
    where id = v_invoice.id;
    select round(coalesce(sum(round(unit_price * quantity, 2)), 0), 2)
      into v_subtotal
      from public.invoice_lines where invoice_id = v_invoice.id;
    v_gst := round(v_invoice.total - v_subtotal, 2);
    select jsonb_build_object(
      'documentType', 'invoice', 'number', v_invoice.invoice_number,
      'issuedOn', coalesce(v_invoice.issued_at, v_invoice.created_at), 'dueOn', v_invoice.due_on, 'invoiceStatus', v_invoice.status,
      'customer', jsonb_build_object('name', v_invoice.customer_name, 'email', v_invoice.customer_email, 'phone', v_customer.phone, 'address', v_invoice.customer_address),
      'studio', jsonb_build_object('address', s.studio_address, 'email', s.studio_email, 'phone', s.studio_phone, 'abn', v_abn),
      'lines', coalesce((select jsonb_agg(jsonb_build_object('description', il.display_name, 'unitPrice', il.unit_price, 'quantity', il.quantity, 'finish', il.finish) order by il.id) from public.invoice_lines il where il.invoice_id = v_invoice.id), '[]'::jsonb),
      'subtotal', v_subtotal, 'discountTotal', 0, 'gstTotal', v_gst, 'totalDue', v_invoice.total,
      'invoiceMilestone', (select jsonb_build_object('description', p.label, 'percentage', p.percentage, 'amount', p.amount, 'dueOn', p.due_on, 'status', p.status) from public.payment_plan_instalments p where p.id = v_invoice.payment_plan_instalment_id)
    ) into v_input
    from public.site_settings s
    where s.id = true;
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

revoke all on function public.capture_quote_payment_schedule_snapshot(uuid) from public;
revoke all on function public.load_authorised_order_document(text, uuid, text) from public;
grant execute on function public.load_authorised_order_document(text, uuid, text) to authenticated, service_role;