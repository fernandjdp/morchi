-- 010 · Backoffice: historial de transiciones administrativas de fulfillment.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

alter table public.inventory_movements
  add column if not exists created_by uuid references auth.users(id);
create table if not exists public.admin_order_activity (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  previous_fulfillment_status text not null,
  new_fulfillment_status text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint admin_order_activity_status_check check (
    previous_fulfillment_status in ('unfulfilled', 'processing', 'packed', 'shipped', 'delivered', 'returned')
    and new_fulfillment_status in ('unfulfilled', 'processing', 'packed', 'shipped', 'delivered', 'returned')
  )
);
create index if not exists admin_order_activity_order_idx
  on public.admin_order_activity (order_id, created_at desc);
alter table public.admin_order_activity enable row level security;
revoke all on public.admin_order_activity from anon, authenticated;
grant all on public.admin_order_activity to service_role;

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid, p_delta integer, p_note text, p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_quantity integer;
begin
  if p_delta = 0 or length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'invalid_adjustment';
  end if;
  select quantity into current_quantity
    from public.inventory_levels where variant_id = p_variant_id for update;
  if not found then raise exception 'inventory_not_found'; end if;
  if current_quantity + p_delta < 0 then raise exception 'insufficient_stock'; end if;
  update public.inventory_levels
    set quantity = quantity + p_delta, updated_at = now()
    where variant_id = p_variant_id;
  insert into public.inventory_movements (variant_id, quantity, movement_type, note, created_by)
    values (p_variant_id, p_delta, 'adjustment', trim(p_note), p_actor_id);
end;
$$;
revoke all on function public.admin_adjust_inventory(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_inventory(uuid, integer, text, uuid) to service_role;
