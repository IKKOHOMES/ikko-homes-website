-- The Display Order number field controls the sequence within its L3 category.
-- New products always append to their L3 category; existing products can be moved
-- by updating their numeric display_order.

create or replace function public.assign_product_display_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  desired_order integer;
  category_count integer;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(coalesce(new.category_id::text, 'uncategorised')));

    select count(*) + 1
      into new.display_order
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

    select count(*) + 1
      into new.display_order
      from public.products
     where category_id is not distinct from new.category_id
       and id <> old.id;
  elsif new.display_order is distinct from old.display_order
    and pg_trigger_depth() = 1 then
    perform pg_advisory_xact_lock(hashtext(coalesce(new.category_id::text, 'uncategorised')));

    select count(*)
      into category_count
      from public.products
     where category_id is not distinct from new.category_id;

    desired_order := greatest(1, least(new.display_order, category_count));

    if desired_order < old.display_order then
      update public.products
         set display_order = display_order + 1
       where category_id is not distinct from new.category_id
         and id <> old.id
         and display_order >= desired_order
         and display_order < old.display_order;
    elsif desired_order > old.display_order then
      update public.products
         set display_order = display_order - 1
       where category_id is not distinct from new.category_id
         and id <> old.id
         and display_order > old.display_order
         and display_order <= desired_order;
    end if;

    new.display_order := desired_order;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_product_display_order on public.products;
create trigger assign_product_display_order
before insert or update of category_id, display_order on public.products
for each row execute function public.assign_product_display_order();

drop function if exists public.move_product_within_category(uuid, text);
