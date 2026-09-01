-- Keep every ORD quote root and its milestone INV root identical.  The root is
-- chosen at confirmation time, after excluding historic invoice roots, so an
-- invoice allocation never silently changes a quote's number.

create or replace function public.ensure_quote_number(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_source public.quotes;
  v_order_id uuid;
  v_period char(6);
  v_sequence bigint;
  v_invoice_root text;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only administrators can assign quote numbers';
  end if;

  select order_id into v_order_id
  from public.quotes
  where id = p_quote_id;
  if not found then raise exception 'Quote % does not exist', p_quote_id; end if;

  -- Keep the shared lifecycle lock order: order, quote, then counter.
  perform 1 from public.orders where id = v_order_id for update;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote % does not exist', p_quote_id; end if;
  if v_quote.status <> 'confirmed' then
    raise exception 'Only confirmed quotes can receive a quote number.';
  end if;
  if v_quote.quote_number is not null then return v_quote.quote_number; end if;

  select * into v_source
  from public.quotes
  where id = coalesce(v_quote.quote_number_source_id, v_quote.id)
  for update;
  if not found or v_source.order_id <> v_quote.order_id or v_source.status <> 'confirmed' then
    raise exception 'A confirmed quote number source is required.';
  end if;
  if v_source.quote_number is not null then return v_source.quote_number; end if;

  -- Numbering is assigned on confirmation, not when the draft quote was made.
  v_period := to_char(clock_timestamp(), 'YYYYMM');
  loop
    insert into public.quote_document_number_counters (period, last_sequence)
    values (v_period, 1)
    on conflict (period) do update
      set last_sequence = public.quote_document_number_counters.last_sequence + 1
    returning last_sequence into v_sequence;

    v_invoice_root := 'INV-' || v_period || lpad(v_sequence::text, 4, '0');
    exit when not exists (
      select 1
      from public.invoice_number_reservations r
      where r.invoice_number ~ ('^' || v_invoice_root || '[A-Z]+$')
    ) and not exists (
      select 1
      from public.invoices i
      where i.invoice_number ~ ('^' || v_invoice_root || '[A-Z]+$')
    );
  end loop;

  update public.quotes
  set quote_number_sequence = v_sequence,
      quote_number = 'ORD-' || v_period || lpad(v_sequence::text, 4, '0')
  where id = v_source.id
    and quote_number is null
  returning quote_number into v_source.quote_number;
  return v_source.quote_number;
end;
$$;

create or replace function public.reserve_payment_plan_invoice_number(
  p_order_id uuid,
  p_instalment_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instalment public.payment_plan_instalments;
  v_quote public.quotes;
  v_source public.quotes;
  v_quote_number text;
  v_period text;
  v_sequence bigint;
  v_number text;
  v_rows integer;
begin
  select * into v_instalment
  from public.payment_plan_instalments
  where id = p_instalment_id and order_id = p_order_id;
  if not found then raise exception 'Payment-plan instalment is unavailable.'; end if;

  select * into v_quote from public.quotes where id = v_instalment.quote_id;
  if not found then raise exception 'Quote is unavailable.'; end if;
  select * into v_source
  from public.quotes
  where id = coalesce(v_quote.quote_number_source_id, v_quote.id);
  if not found then raise exception 'Quote number source is unavailable.'; end if;

  v_quote_number := coalesce(v_source.quote_number, v_quote.quote_number);
  if v_quote_number ~ '^ORD-[0-9]{6}[0-9]+$' then
    v_period := substring(v_quote_number from '^ORD-([0-9]{6})[0-9]+$');
    v_sequence := coalesce(v_source.quote_number_sequence, v_quote.quote_number_sequence);
    if v_sequence is null then
      v_sequence := substring(v_quote_number from '^ORD-[0-9]{6}([0-9]+)$')::bigint;
    end if;
    v_number := 'INV-' || v_period || lpad(v_sequence::text, 4, '0') || public.excel_milestone_suffix(v_instalment.sequence);

    if exists (select 1 from public.invoices where invoice_number = v_number)
      or exists (select 1 from public.invoice_number_reservations where invoice_number = v_number) then
      raise exception 'Quote invoice root is already reserved.';
    end if;

    insert into public.invoice_number_reservations (invoice_number)
    values (v_number)
    on conflict (invoice_number) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Quote invoice root is already reserved.';
    end if;
    return v_number;
  end if;

  -- Historical non-ORD quotes retain their immutable legacy allocator.
  return public.reserve_legacy_invoice_number();
end;
$$;

-- Draft invoice numbers encode their existing schedule position.  Once a draft
-- exists, details may still change, but an existing row cannot move.
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
  select q.id,q.total into v_quote from public.quotes q where q.id=p_quote_id and q.order_id=p_order_id and q.status='confirmed' for update;
  if not found then raise exception 'A confirmed quote is required.'; end if;
  if exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','') is not null group by lower(e->>'id') having count(*)>1) then raise exception 'Payment plan instalment IDs must be unique.'; end if;
  if exists (select 1 from public.payment_plan_instalments p where p.order_id=p_order_id and p.status<>'draft' and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','')::uuid=p.id)) then raise exception 'Issued or paid instalments cannot be removed.'; end if;
  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text,label text,percentage numeric,amount numeric,"dueOn" date,"internalNote" text) loop
    if coalesce(trim(v_input.label),'')='' or v_input.amount is null or v_input.amount<=0 or v_input.percentage is null or v_input.percentage<=0 or v_input."dueOn" is null then raise exception 'Invalid payment plan instalment.'; end if;
    if abs(round(v_input.percentage,2)-round((round(v_input.amount,2)/round(v_quote.total,2))*100,2)) > 0.01 then raise exception 'Instalment percentage must match its cent-rounded amount.'; end if;
    v_amount_total := v_amount_total + v_input.amount; v_percentage_total := v_percentage_total + v_input.percentage;
  end loop;
  if round(v_amount_total,2)<>round(v_quote.total,2) or abs(round(v_percentage_total,2)-100)>0.01 then raise exception 'Instalments must equal the confirmed quote total.'; end if;

  if exists (select 1 from public.invoices where order_id = p_order_id and status = 'draft')
    and exists (
      select 1
      from jsonb_array_elements(p_instalments) with ordinality as e(value, position)
      join public.payment_plan_instalments p on p.id = nullif(e.value->>'id', '')::uuid
      where p.order_id = p_order_id
        and p.sequence <> e.position
    ) then
    raise exception 'Draft invoices lock payment plan sequence.';
  end if;

  delete from public.invoices i where i.order_id=p_order_id and i.status='draft' and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','')::uuid=i.payment_plan_instalment_id);
  delete from public.payment_plan_instalments p where p.order_id=p_order_id and p.status='draft' and not exists (select 1 from jsonb_array_elements(p_instalments) e where nullif(e->>'id','')::uuid=p.id);
  select coalesce(max(sequence),0) + jsonb_array_length(p_instalments) + 1 into v_temp_base from public.payment_plan_instalments where order_id=p_order_id;
  with drafts as (select p.id, row_number() over (order by p.id) n from public.payment_plan_instalments p where p.order_id=p_order_id and p.status='draft')
  update public.payment_plan_instalments p set sequence=v_temp_base+drafts.n from drafts where p.id=drafts.id;
  for v_input in select * from jsonb_to_recordset(p_instalments) as x(id text,label text,percentage numeric,amount numeric,"dueOn" date,"internalNote" text) loop
    v_sequence := v_sequence+1;
    if nullif(v_input.id,'') is null then
      insert into public.payment_plan_instalments (order_id,quote_id,sequence,label,percentage,amount,due_on,internal_note,status) values (p_order_id,p_quote_id,v_sequence,trim(v_input.label),round(v_input.percentage,2),round(v_input.amount,2),v_input."dueOn",coalesce(trim(v_input."internalNote"),''),'draft') returning * into v_instalment;
    else
      select * into v_instalment from public.payment_plan_instalments p where p.id=v_input.id::uuid and p.order_id=p_order_id;
      if not found then raise exception 'Payment plan instalment not found.'; end if;
      if v_instalment.status<>'draft' then
        if v_instalment.sequence<>v_sequence or v_instalment.label is distinct from trim(v_input.label) or v_instalment.percentage is distinct from round(v_input.percentage,2) or v_instalment.amount is distinct from round(v_input.amount,2) or v_instalment.due_on is distinct from v_input."dueOn" or v_instalment.internal_note is distinct from coalesce(trim(v_input."internalNote"),'') then raise exception 'Issued or paid instalments cannot be changed.'; end if;
        select * into v_invoice from public.invoices where payment_plan_instalment_id=v_instalment.id for update;
        if not found or v_invoice.status not in ('issued','paid') then raise exception 'Immutable instalment invoice is unavailable.'; end if;
        id:=v_invoice.id; invoice_number:=v_invoice.invoice_number; instalment_id:=v_instalment.id; status:=v_invoice.status; return next; continue;
      end if;
      update public.payment_plan_instalments p set quote_id=p_quote_id,sequence=v_sequence,label=trim(v_input.label),percentage=round(v_input.percentage,2),amount=round(v_input.amount,2),due_on=v_input."dueOn",internal_note=coalesce(trim(v_input."internalNote"),'') where p.id=v_instalment.id returning * into v_instalment;
    end if;
    v_invoice:=public.sync_payment_plan_invoice_draft(p_order_id,v_order.order_number,v_order.customer_name,v_order.customer_email,v_order.customer_address,v_instalment.id,v_instalment.label,v_instalment.amount,v_instalment.due_on);
    id:=v_invoice.id; invoice_number:=v_invoice.invoice_number; instalment_id:=v_instalment.id; status:='draft'; return next;
  end loop;
end;
$$;

-- The established issue path returns an `id` column, so qualify table IDs to
-- avoid PL/pgSQL output-column ambiguity during the rollout.
create or replace function public.issue_payment_plan_invoice(p_order_id uuid, p_invoice_id uuid)
returns table (id uuid, invoice_number text, instalment_id uuid, status public.invoice_status)
language plpgsql security definer set search_path = public
as $$
declare v_invoice public.invoices; v_instalment public.payment_plan_instalments; v_subtotal numeric(12,2);
begin
  perform public.assert_payment_plan_admin();
  perform public.lock_payment_plan_order(p_order_id);
  select * into v_invoice from public.invoices i where i.id = p_invoice_id and i.order_id = p_order_id for update;
  if not found or v_invoice.payment_plan_instalment_id is null then raise exception 'A draft invoice for this order is required.'; end if;
  select * into v_instalment from public.payment_plan_instalments p where p.id = v_invoice.payment_plan_instalment_id and p.order_id = p_order_id for update;
  if not found then raise exception 'A draft invoice for this order is required.'; end if;
  if v_invoice.status = 'issued' and v_instalment.status = 'issued' then
    id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'issued'; return next; return;
  end if;
  if v_invoice.status <> 'draft' or v_instalment.status <> 'draft' then raise exception 'A draft invoice for this order is required.'; end if;
  select round(coalesce(sum(round(il.unit_price * il.quantity, 2)), 0), 2) into v_subtotal from public.invoice_lines il where il.invoice_id = v_invoice.id;
  if v_subtotal <> round(v_invoice.total / 1.10, 2) then raise exception 'Draft invoice lines must be GST-exclusive before issue.'; end if;
  update public.invoices i set status = 'issued' where i.id = v_invoice.id;
  update public.payment_plan_instalments p set status = 'issued' where p.id = v_instalment.id;
  update public.orders o set status = 'invoiced' where o.id = p_order_id and o.status = 'quoted';
  insert into public.order_status_events (order_id, status, note) values (p_order_id, 'invoiced', 'Invoice ' || v_invoice.invoice_number || ' issued.');
  id := v_invoice.id; invoice_number := v_invoice.invoice_number; instalment_id := v_instalment.id; status := 'issued'; return next;
end;
$$;
revoke all on function public.ensure_quote_number(uuid) from public;
revoke all on function public.reserve_payment_plan_invoice_number(uuid, uuid) from public;
revoke all on function public.replace_payment_plan_and_sync_invoices(uuid, uuid, jsonb) from public;
revoke all on function public.issue_payment_plan_invoice(uuid, uuid) from public;
grant execute on function public.ensure_quote_number(uuid) to authenticated, service_role;
grant execute on function public.reserve_payment_plan_invoice_number(uuid, uuid) to service_role;
grant execute on function public.replace_payment_plan_and_sync_invoices(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.issue_payment_plan_invoice(uuid, uuid) to authenticated, service_role;