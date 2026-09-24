-- 004 · Checkout y pedidos
-- Pedidos, líneas con snapshot histórico y direcciones. Fuente: specs/base.md.
-- RLS: el usuario autenticado solo lee sus propios pedidos; las mutaciones
-- se realizan con service_role (constitución §III y §VI).

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  status text not null default 'pending'
    check (status in (
      'pending', 'confirmed', 'processing', 'shipped',
      'completed', 'cancelled', 'refunded'
    )),
  payment_status text not null default 'pending'
    check (payment_status in (
      'pending', 'approved', 'rejected', 'refunded', 'cancelled'
    )),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in (
      'unfulfilled', 'processing', 'packed', 'shipped', 'delivered', 'returned'
    )),
  currency text not null default 'ARS',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  shipping_total numeric(12,2) not null default 0 check (shipping_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  total numeric(12,2) not null check (total >= 0),
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);

-- Idempotencia de checkout (FR-010): un reintento con la misma clave no crea
-- un pedido duplicado. Un pedido cancelado libera la clave para reintentar.
alter table public.orders add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_key
  on public.orders (idempotency_key)
  where idempotency_key is not null and status <> 'cancelled';

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
  on public.orders for select to authenticated
  using (user_id = auth.uid());

revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;

-- ---------------------------------------------------------------------------
-- order_items (snapshot histórico de la compra)
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  sku text,
  product_name text not null,
  variant_description text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_variant_idx on public.order_items (variant_id);

alter table public.order_items enable row level security;

drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

revoke all on public.order_items from anon, authenticated;
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;

-- ---------------------------------------------------------------------------
-- order_addresses (snapshot de dirección)
-- ---------------------------------------------------------------------------
create table if not exists public.order_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  address_type text not null check (address_type in ('shipping', 'billing')),
  recipient_name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  postal_code text not null,
  country text not null,
  phone text,
  unique (order_id, address_type)
);

create index if not exists order_addresses_order_idx on public.order_addresses (order_id);

alter table public.order_addresses enable row level security;

drop policy if exists order_addresses_select_own on public.order_addresses;
create policy order_addresses_select_own
  on public.order_addresses for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_addresses.order_id
        and o.user_id = auth.uid()
    )
  );

revoke all on public.order_addresses from anon, authenticated;
grant select on public.order_addresses to authenticated;
grant all on public.order_addresses to service_role;
