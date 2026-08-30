alter table public.invoices
  add column if not exists issued_at timestamptz;

-- Existing non-draft records predate this column, so their creation timestamp is
-- the only available issue-date value. New draft-to-issued transitions use now().
update public.invoices
set issued_at = created_at
where issued_at is null
  and status in ('issued', 'paid');

create or replace function public.set_invoice_issued_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'draft' then
    new.issued_at := null;
  elsif tg_op = 'INSERT' or old.status not in ('issued', 'paid') then
    new.issued_at := now();
  elsif new.issued_at is null then
    new.issued_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_issued_at on public.invoices;
create trigger set_invoice_issued_at
before insert or update of status on public.invoices
for each row execute procedure public.set_invoice_issued_at();