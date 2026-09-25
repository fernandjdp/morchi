# Migraciones de Supabase

Las migraciones versionadas viven en `supabase/migrations/` y son la fuente de
verdad del esquema (constitución §III). El SQL aplicado a mano en el dashboard no
se considera fuente de verdad.

## Archivos

```text
20260920000001_catalog.sql            001 Catálogo (products, variants, sizes, colors, categories, images)
20260920000002_customers.sql          002 Clientes (profiles, addresses)
20260920000003_inventory.sql          006 Inventario (levels, movements, vista de disponibilidad)
20260920000004_orders.sql             004 Pedidos (orders, order_items, order_addresses)
20260920000005_payments.sql           005 Pagos (payments + idempotencia)
20260920000006_checkout_functions.sql 004/006 Funciones transaccionales (reserva/venta/liberación)
20260920000007_cart.sql                 003 Carrito
20260924000001_admin_activity.sql       010 Backoffice (auditoría, Storage público de catálogo, ajuste atómico)
```

La migración del carrito también agrega `session_token` cuando `carts` ya existe
desde el esquema base anterior, que no tenía soporte para sesiones anónimas.

## Base de datos existente

Las migraciones están escritas de forma idempotente (`create table if not
exists`, `drop policy if exists`, `create or replace function`). Sobre una base
que ya tiene las tablas de `specs/base.md`:

1. Aplicar las migraciones en orden con Supabase CLI:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   o ejecutar los `.sql` en orden con `psql`.

2. Si preferís no re-ejecutar el DDL ya aplicado, marcá la migración base como
   aplicada:

   ```bash
   supabase migration repair --status applied 20260920000001
   ```

## Base limpia

```bash
supabase db reset
```

## Regenerar tipos

Los tipos de `types/database.types.ts` se mantienen a mano. Si se usa Supabase
CLI, pueden regenerarse:

```bash
supabase gen types typescript --linked > types/database.types.ts
```

## Seguridad

- RLS habilitado en todas las tablas expuestas, con políticas explícitas y
  grants por columna cuando corresponde (`product_variants.cost_price` nunca se
  expone al cliente).
- `inventory_levels` / `inventory_movements` no son accesibles por
  `anon`/`authenticated`; la disponibilidad pública se expone solo como número a
  través de `product_variant_availability`.
- Las funciones de checkout e inventario son `SECURITY DEFINER`, con
  `search_path` fijo, y su `EXECUTE` está restringido a `service_role`.
- El backoffice exige que un operador autenticado tenga el claim confiable
  `app_metadata.role = "admin"`. Asigná ese claim únicamente mediante un
  mecanismo administrativo confiable de Supabase Auth; no uses `user_metadata`
  ni habilites una ruta pública de autoasignación. Sin el claim, el área queda
  denegada. La clave `SUPABASE_SECRET_KEY` se usa solo en el servidor y después
  de verificar la sesión y el rol.
