-- 003 · Carrito
-- Carrito activo por cliente autenticado o por sesión anónima. Fuente: specs/base.md.
-- RLS: el usuario autenticado solo accede a sus propios carritos; los carritos
-- anónimos se gestionan server-side con service_role y una cookie httpOnly.

-- ---------------------------------------------------------------------------
-- carts
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  session_token text,
  status text not null default 'active'
    check (status in ('active', 'converted', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_present check (user_id is not null or session_token is not null)
);

-- Un solo carrito activo por usuario y por sesión anónima.
create unique index if not exists carts_user_active_key
  on public.carts (user_id)
  where user_id is not null and status = 'active';
create unique index if not exists carts_session_active_key
  on public.carts (session_token)
  where session_token is not null and status = 'active';

drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

alter table public.carts enable row level security;

drop policy if exists carts_select_own on public.carts;
create policy carts_select_own
  on public.carts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists carts_insert_own on public.carts;
create policy carts_insert_own
  on public.carts for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists carts_update_own on public.carts;
create policy carts_update_own
  on public.carts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.carts from anon, authenticated;
grant select, insert, update on public.carts to authenticated;
grant all on public.carts to service_role;

-- ---------------------------------------------------------------------------
-- cart_items
-- ---------------------------------------------------------------------------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index if not exists cart_items_cart_idx on public.cart_items (cart_id);

alter table public.cart_items enable row level security;

drop policy if exists cart_items_select_own on public.cart_items;
create policy cart_items_select_own
  on public.cart_items for select to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own
  on public.cart_items for insert to authenticated
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own
  on public.cart_items for update to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own
  on public.cart_items for delete to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = auth.uid()
    )
  );

revoke all on public.cart_items from anon, authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;
