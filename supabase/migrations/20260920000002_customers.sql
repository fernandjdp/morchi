-- 002 · Clientes
-- Perfiles y direcciones. Fuente de verdad: specs/base.md.
-- RLS: cada usuario solo accede a lo propio (constitución §III y §IV).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- Crea el perfil automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  postal_code text not null,
  country text not null default 'AR',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses (user_id);

alter table public.addresses enable row level security;

drop policy if exists addresses_select_own on public.addresses;
create policy addresses_select_own
  on public.addresses for select to authenticated
  using (user_id = auth.uid());

drop policy if exists addresses_insert_own on public.addresses;
create policy addresses_insert_own
  on public.addresses for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists addresses_update_own on public.addresses;
create policy addresses_update_own
  on public.addresses for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists addresses_delete_own on public.addresses;
create policy addresses_delete_own
  on public.addresses for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.addresses from anon, authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
