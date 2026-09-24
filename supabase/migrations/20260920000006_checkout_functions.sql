-- 006 · Funciones transaccionales de checkout e inventario
-- La creación de pedido + líneas + reserva de stock ocurre en una única
-- transacción PostgreSQL (constitución §III y §VI; spec 006).
--
-- Estas funciones son SECURITY DEFINER con search_path fijo y su ejecución
-- queda restringida a service_role: nunca se exponen al cliente.

-- ---------------------------------------------------------------------------
-- create_checkout_order: valida variantes, congela precios y reserva stock.
-- ---------------------------------------------------------------------------
create or replace function public.create_checkout_order(
  p_user_id uuid,
  p_email text,
  p_items jsonb,
  p_idempotency_key text default null,
  p_cart_id uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_qty int;
  v_variant record;
  v_subtotal numeric(12,2) := 0;
begin
  -- Reintento del mismo checkout: devuelve el pedido existente sin duplicar.
  if p_idempotency_key is not null then
    select *
      into v_order
      from public.orders
     where idempotency_key = p_idempotency_key
       and status <> 'cancelled'
     limit 1;
    if found then
      return v_order;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email_required' using errcode = 'P0001';
  end if;

  -- Reclama el carrito dentro de la misma transacción (FR-009, SC-003):
  -- dos checkouts concurrentes del mismo carrito no pueden crear dos pedidos.
  if p_cart_id is not null then
    update public.carts
       set status = 'converted',
           updated_at = now()
     where id = p_cart_id
       and status = 'active';
    if not found then
      raise exception 'cart_not_active' using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.orders (
      user_id, email, status, payment_status, fulfillment_status,
      currency, subtotal, total, idempotency_key
    )
    values (
      p_user_id, p_email, 'pending', 'pending', 'unfulfilled',
      'ARS', 0, 0, p_idempotency_key
    )
    returning * into v_order;
  exception when unique_violation then
    -- Carrera entre dos reintentos con la misma clave.
    select *
      into v_order
      from public.orders
     where idempotency_key = p_idempotency_key
       and status <> 'cancelled'
     limit 1;
    if not found then
      raise;
    end if;
    return v_order;
  end;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'quantity')::int;

    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;

    -- Bloquea la variante para serializar checkouts concurrentes.
    select
      pv.id,
      pv.sku,
      pv.price,
      pv.product_id,
      p.name as product_name,
      nullif(concat_ws(' / ', s.name, c.name), '') as variant_description
    into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    left join public.sizes s on s.id = pv.size_id
    left join public.colors c on c.id = pv.color_id
    where pv.id = (v_item ->> 'variant_id')::uuid
      and pv.is_active
      and p.status = 'active'
      and p.deleted_at is null
    for update of pv;

    if not found then
      raise exception 'variant_not_buyable:%', coalesce(v_item ->> 'variant_id', '?')
        using errcode = 'P0001';
    end if;

    -- Reserva atómica: falla si no hay disponible suficiente.
    update public.inventory_levels
       set reserved_quantity = reserved_quantity + v_qty,
           updated_at = now()
     where variant_id = v_variant.id
       and quantity - reserved_quantity >= v_qty;

    if not found then
      raise exception 'insufficient_stock:%', v_variant.id using errcode = 'P0001';
    end if;

    insert into public.inventory_movements (
      variant_id, quantity, movement_type, reference_id
    )
    values (v_variant.id, -v_qty, 'reservation', v_order.id);

    insert into public.order_items (
      order_id, product_id, variant_id, sku, product_name,
      variant_description, unit_price, quantity, line_total
    )
    values (
      v_order.id, v_variant.product_id, v_variant.id, v_variant.sku,
      v_variant.product_name, v_variant.variant_description,
      v_variant.price, v_qty, v_variant.price * v_qty
    );

    v_subtotal := v_subtotal + (v_variant.price * v_qty);
  end loop;

  update public.orders
     set subtotal = v_subtotal,
         total = v_subtotal,
         updated_at = now()
   where id = v_order.id
   returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_order_inventory: convierte la reserva en venta (idempotente).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
begin
  -- Si ya se confirmó la venta, no repetir efectos.
  if exists (
    select 1 from public.inventory_movements
    where reference_id = p_order_id and movement_type = 'sale'
  ) then
    return;
  end if;

  for v_item in
    select variant_id, quantity
    from public.order_items
    where order_id = p_order_id and variant_id is not null
  loop
    update public.inventory_levels
       set quantity = quantity - v_item.quantity,
           reserved_quantity = greatest(reserved_quantity - v_item.quantity, 0),
           updated_at = now()
     where variant_id = v_item.variant_id;

    insert into public.inventory_movements (
      variant_id, quantity, movement_type, reference_id
    )
    values (v_item.variant_id, -v_item.quantity, 'sale', p_order_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_order_inventory: libera reservas no confirmadas (idempotente).
-- ---------------------------------------------------------------------------
create or replace function public.release_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
begin
  -- Si ya se vendió, no se libera. Si ya se liberó, no se repite.
  if exists (
    select 1 from public.inventory_movements
    where reference_id = p_order_id and movement_type in ('sale', 'release')
  ) then
    return;
  end if;

  for v_item in
    select variant_id, quantity
    from public.order_items
    where order_id = p_order_id and variant_id is not null
  loop
    update public.inventory_levels
       set reserved_quantity = greatest(reserved_quantity - v_item.quantity, 0),
           updated_at = now()
     where variant_id = v_item.variant_id;

    insert into public.inventory_movements (
      variant_id, quantity, movement_type, reference_id
    )
    values (v_item.variant_id, v_item.quantity, 'release', p_order_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: solo el backend privilegiado puede invocarlas.
-- ---------------------------------------------------------------------------
revoke all on function public.create_checkout_order(uuid, text, jsonb, text, uuid)
  from public, anon, authenticated;
revoke all on function public.confirm_order_inventory(uuid)
  from public, anon, authenticated;
revoke all on function public.release_order_inventory(uuid)
  from public, anon, authenticated;

grant execute on function public.create_checkout_order(uuid, text, jsonb, text, uuid) to service_role;
grant execute on function public.confirm_order_inventory(uuid) to service_role;
grant execute on function public.release_order_inventory(uuid) to service_role;
