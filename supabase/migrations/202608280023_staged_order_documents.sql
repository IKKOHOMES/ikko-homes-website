alter type public.invoice_status add value if not exists 'paid';

alter table public.quotes
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'confirmed')),
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id);

alter table public.quote_lines
  add column if not exists is_tbd boolean not null default false;

create type public.payment_instalment_status as enum ('draft', 'issued', 'paid', 'overdue');

create table public.payment_plan_instalments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  label text not null check (length(trim(label)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  due_on date not null,
  status public.payment_instalment_status not null default 'draft',
  paid_at timestamptz,
  internal_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, sequence)
);

create trigger touch_payment_plan_instalments
  before update on public.payment_plan_instalments
  for each row execute procedure public.touch_updated_at();

alter table public.invoices
  add column if not exists payment_plan_instalment_id uuid unique references public.payment_plan_instalments(id),
  add column if not exists due_on date,
  add column if not exists paid_at timestamptz;

create table public.order_document_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  document_type text not null check (document_type in ('quote', 'invoice')),
  recipient_email text not null,
  sent_at timestamptz,
  provider_message_id text,
  outcome text not null check (outcome in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  check ((document_type = 'quote' and quote_id is not null and invoice_id is null)
      or (document_type = 'invoice' and invoice_id is not null and quote_id is null))
);

alter table public.payment_plan_instalments enable row level security;
alter table public.order_document_deliveries enable row level security;

create policy "admins manage payment plans"
  on public.payment_plan_instalments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admins read delivery log"
  on public.order_document_deliveries for select to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.payment_plan_instalments to authenticated, service_role;
grant select, insert on public.order_document_deliveries to authenticated, service_role;
grant select, insert, update on public.quotes, public.quote_lines, public.invoices, public.invoice_lines to service_role;
