-- 003 · Inventario
-- Existencias y movimientos. Fuente de verdad: specs/base.md y spec 006.
-- RLS: el cliente no puede leer ni modificar inventario crudo (FR-010).
-- La disponibilidad pública se expone mediante una vista que solo publica el
-- número disponible, nunca las cantidades crudas.

-- ---------------------------------------------------------------------------
-- inventory_levels
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null unique references public.product_variants(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now()
);

alter table public.inventory_levels enable row level security;

-- Sin políticas para anon/authenticated: acceso denegado por defecto.
revoke all on public.inventory_levels from anon, authenticated;
grant all on public.inventory_levels to service_role;

-- ---------------------------------------------------------------------------
-- inventory_movements
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id),
  quantity int not null check (quantity <> 0),
  movement_type text not null
    check (movement_type in (
      'purchase', 'sale', 'reservation', 'release', 'adjustment', 'return'
    )),
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_variant_idx
  on public.inventory_movements (variant_id, created_at desc);
create index if not exists inventory_movements_reference_idx
  on public.inventory_movements (reference_id);

alter table public.inventory_movements enable row level security;

revoke all on public.inventory_movements from anon, authenticated;
grant all on public.inventory_movements to service_role;

-- ---------------------------------------------------------------------------
-- Disponibilidad pública (solo el número disponible)
-- ---------------------------------------------------------------------------
create or replace view public.product_variant_availability as
select
  il.variant_id,
  greatest(il.quantity - il.reserved_quantity, 0) as available
from public.inventory_levels il;

revoke all on public.product_variant_availability from anon, authenticated;
grant select on public.product_variant_availability to anon, authenticated;
grant all on public.product_variant_availability to service_role;
