-- 005 · Pagos
-- Registro local de pagos y referencias externas. Fuente: specs/base.md.
-- Idempotencia: (provider, provider_payment_id) es único (constitución §VI).

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null
    check (provider in ('mercadopago', 'cash', 'bank_transfer', 'other')),
  provider_payment_id text,
  provider_preference_id text,
  status text not null
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  raw_response jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments (order_id);

-- Un mismo pago externo no puede registrarse dos veces (webhooks reintentados).
create unique index if not exists payments_provider_payment_id_key
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
  on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.user_id = auth.uid()
    )
  );

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
