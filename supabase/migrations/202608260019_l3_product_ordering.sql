with ordered_products as (
  select id, row_number() over (
    partition by category_id
    order by display_order, name, id
  ) as next_display_order
  from public.products
)
update public.products
set display_order = ordered_products.next_display_order
from ordered_products
where products.id = ordered_products.id;

create or replace function public.assign_product_display_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'insert' then
    perform pg_advisory_xact_lock(hashtext(coalesce(new.category_id::text, 'uncategorised')));
    select count(*) + 1 into new.display_order
    from public.products
    where category_id is not distinct from new.category_id;
  elsif new.category_id is distinct from old.category_id then
    perform pg_advisory_xact_lock(hashtext(coalesce(old.category_id::text, 'uncategorised')));
    perform pg_advisory_xact_lock(hashtext(coalesce(new.category_id::text, 'uncategorised')));

    update public.products
    set display_order = display_order - 1
    where category_id is not distinct from old.category_id
      and id <> old.id
      and display_order > old.display_order;

    select count(*) + 1 into new.display_order
    from public.products
    where category_id is not distinct from new.category_id
      and id <> old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_product_display_order on public.products;
create trigger assign_product_display_order
before insert or update of category_id on public.products
for each row execute function public.assign_product_display_order();

create or replace function public.move_product_within_category(
  p_product_id uuid,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_product public.products%rowtype;
  adjacent_product public.products%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'Order direction must be up or down.';
  end if;

  select * into current_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  perform pg_advisory_xact_lock(hashtext(coalesce(current_product.category_id::text, 'uncategorised')));

  if p_direction = 'up' then
    select * into adjacent_product
    from public.products
    where category_id is not distinct from current_product.category_id
      and display_order < current_product.display_order
    order by display_order desc, name desc, id desc
    limit 1
    for update;
  else
    select * into adjacent_product
    from public.products
    where category_id is not distinct from current_product.category_id
      and display_order > current_product.display_order
    order by display_order, name, id
    limit 1
    for update;
  end if;

  if not found then
    return;
  end if;

  update public.products
  set display_order = case
    when id = current_product.id then adjacent_product.display_order
    else current_product.display_order
  end
  where id in (current_product.id, adjacent_product.id);
end;
$$;

grant execute on function public.move_product_within_category(uuid, text) to authenticated;
