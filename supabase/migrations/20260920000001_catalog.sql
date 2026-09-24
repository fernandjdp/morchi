-- 001 · Catálogo
-- Esquema canónico de catálogo. Fuente de verdad: specs/base.md.
-- Baseline idempotente: puede aplicarse sobre una base que ya tenga las tablas.
-- RLS habilitado con políticas explícitas + grants (constitución §III).

-- ---------------------------------------------------------------------------
-- Helper updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  brand text,
  product_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists products_status_idx
  on public.products (status)
  where deleted_at is null;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products
  for select
  to anon, authenticated
  using (status = 'active' and deleted_at is null);

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;

-- ---------------------------------------------------------------------------
-- sizes
-- ---------------------------------------------------------------------------
create table if not exists public.sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

alter table public.sizes enable row level security;

drop policy if exists sizes_public_read on public.sizes;
create policy sizes_public_read
  on public.sizes for select to anon, authenticated using (true);

revoke all on public.sizes from anon, authenticated;
grant select on public.sizes to anon, authenticated;
grant all on public.sizes to service_role;

-- ---------------------------------------------------------------------------
-- colors
-- ---------------------------------------------------------------------------
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex_code text,
  sort_order int not null default 0
);

alter table public.colors enable row level security;

drop policy if exists colors_public_read on public.colors;
create policy colors_public_read
  on public.colors for select to anon, authenticated using (true);

revoke all on public.colors from anon, authenticated;
grant select on public.colors to anon, authenticated;
grant all on public.colors to service_role;

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size_id uuid references public.sizes(id),
  color_id uuid references public.colors(id),
  sku text not null unique,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price >= 0),
  cost_price numeric(12,2),
  barcode text,
  weight_grams int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, size_id, color_id)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id);

alter table public.product_variants enable row level security;

drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read
  on public.product_variants
  for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.products p
      where p.id = product_variants.product_id
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

-- `cost_price` es información de margen: nunca se expone al cliente.
revoke all on public.product_variants from anon, authenticated;
grant select (
  id, product_id, size_id, color_id, sku, price,
  compare_at_price, barcode, weight_grams, is_active, created_at
) on public.product_variants to anon, authenticated;
grant all on public.product_variants to service_role;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  parent_id uuid references public.categories(id)
);

alter table public.categories enable row level security;

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read
  on public.categories for select to anon, authenticated using (true);

revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;

-- ---------------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_idx
  on public.product_categories (category_id);

alter table public.product_categories enable row level security;

drop policy if exists product_categories_public_read on public.product_categories;
create policy product_categories_public_read
  on public.product_categories
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_categories.product_id
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

revoke all on public.product_categories from anon, authenticated;
grant select on public.product_categories to anon, authenticated;
grant all on public.product_categories to service_role;

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  storage_path text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx
  on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_images.product_id
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

revoke all on public.product_images from anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant all on public.product_images to service_role;
