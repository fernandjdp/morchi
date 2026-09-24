# Implementation Plan: Inventario, reservas y movimientos

Feature Branch: `006-inventory`

Spec: [spec.md](./spec.md)

Referencias de gobierno: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) (v1.0.0), [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §11.2, §17, §18, [`ROADMAP.md`](../../ROADMAP.md).

---

## Summary

El módulo `006-inventory` administra la disponibilidad real de cada variante vendible. Introduce dos tablas (`inventory_levels` e `inventory_movements`), un conjunto de funciones PostgreSQL `SECURITY DEFINER` que ejecutan reserva, confirmación (venta) y liberación de forma atómica e idempotente, y una capa TypeScript server-side (`features/inventory/`) que las invoca por RPC.

Decisiones ya fijadas que este plan refleja:

- La disponibilidad vendible se define como `quantity - reserved_quantity` (FR-002, FR-003).
- Las operaciones críticas son funciones PostgreSQL atómicas, no lecturas-modificaciones desde la aplicación (ARCHITECTURE.md §11.2, §17).
- La reserva ocurre dentro de la transacción de checkout (`create_checkout_order`); la confirmación de pago convierte reserva en venta (`confirm_order_inventory`) y la cancelación libera la reserva (`release_order_inventory`). Confirmación y liberación son idempotentes (FR-009, SC-004).
- Cada cambio deja un `inventory_movement` con `movement_type` en (`purchase`, `sale`, `reservation`, `release`, `adjustment`, `return`) y `reference_id` de negocio cuando existe (FR-006, FR-007, FR-008).
- La concurrencia se controla con `SELECT ... FOR UPDATE` más constraints `quantity >= 0` y `reserved_quantity >= 0` (SC-001, SC-002).
- El cliente no puede modificar inventario: RLS sin políticas de escritura y `EXECUTE` de las funciones restringido a `service_role` (FR-010).

Este plan no reimplementa catálogo (001), checkout/pedidos (004) ni pagos (005); consume sus contratos y coordina la parte de stock.

---

## Technical Context

| Aspecto | Decisión |
|---|---|
| Framework | Next.js App Router (Server Components y server actions / código de servidor) |
| Base de datos | Supabase PostgreSQL como system of record |
| Lenguaje | TypeScript `strict` |
| Estructura | Root-based, alias `@/*` → `./*`, **sin** `src/` |
| Cliente privilegiado | `lib/supabase/admin.ts` (`createAdminClient`, `service_role`, `server-only`) |
| Cliente público | `lib/supabase/server.ts` / `lib/supabase/browser.ts` (solo lectura de disponibilidad) |
| Variables de entorno | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server-only) |
| Migraciones | `supabase/migrations/*.sql` versionadas en el repo |
| Tests | Vitest (unit + integración contra Postgres aislado) y Playwright (e2e crítico). Aún no instalados: ver Fase 0. |
| Observabilidad | Logs estructurados server-side con `correlation_id` y código de operación/error estable (constitución §VII) |

Sin dependencias nuevas de runtime. El único runtime relevante es `@supabase/supabase-js` ya presente.

---

## Constitution Check

| Principio | Evaluación | Evidencia / mitigación |
|---|---|---|
| I. Spec-Driven Modular Architecture | PASS | Existe `spec.md` con FR-001..FR-010 y SC-001..SC-004. Fronteras: `001-catalog` define variantes vendibles, `004-checkout-orders` crea el pedido, `005-payments` confirma el pago, `006-inventory` es dueño del stock. Dependencias acíclicas y explícitas. |
| II. Next.js Server-First | PASS | Toda mutación de stock ocurre en PostgreSQL vía RPC invocada desde código server-only. No hay reglas de negocio de stock en Client Components. |
| III. Supabase Data Integrity & Security | PASS (foco) | Migraciones versionadas; constraints `quantity >= 0`, `reserved_quantity >= 0`, `movement_type` enumerado, FK a `product_variants`; operaciones multi-registro dentro de funciones transaccionales; RLS habilitado con políticas explícitas por operación. |
| IV. Secure Boundaries & Secrets | PASS | `SUPABASE_SECRET_KEY` solo en `lib/supabase/admin.ts` (`server-only`). Ninguna función de escritura se expone al navegador. |
| V. Test-Backed Quality | PASS (planificado) | Tests unitarios de cálculo de disponibilidad, integración contra DB, tests de concurrencia (SC-001/SC-002), de disponibilidad negativa e idempotencia de reserva/liberación (SC-004) y de RLS (FR-010). Ver Fase 5. |
| VI. Idempotent Commerce & Integration Workflows | PASS (foco) | `confirm_order_inventory` y `release_order_inventory` son no-op ante reproceso; índice único parcial sobre `(variant_id, movement_type, reference_id)`; `reference_id` de negocio obliga a detectar duplicados. |
| VII. Observable, Performant, Accessible Delivery | PASS | Logs estructurados con correlación y códigos estables; lectura de disponibilidad por índice único de `variant_id`; este módulo no introduce UI, por lo que no hay superficie de accesibilidad nueva. |

**Complexity Tracking:** sin desviaciones de reglas MUST. No se requiere justificación adicional.

---

## Project Structure

```text
features/
└── inventory/
    ├── types/
    │   └── inventory.types.ts          # tipos de dominio y de RPC
    ├── queries/
    │   ├── get-variant-availability.ts # disponibilidad de una variante
    │   └── get-variants-availability.ts# disponibilidad de varias variantes
    └── services/
        ├── reserve-inventory.ts        # wrapper de reserve_inventory (uso interno/admin)
        ├── create-checkout-order.ts    # RPC create_checkout_order (límite 004)
        ├── confirm-order-inventory.ts  # RPC confirm_order_inventory
        └── release-order-inventory.ts  # RPC release_order_inventory

supabase/
└── migrations/
    ├── 20260920000100_inventory_schema.sql    # tablas, constraints, índices
    ├── 20260920000110_inventory_rls.sql       # RLS, grants y vista de disponibilidad
    └── 20260920000120_inventory_functions.sql # funciones atómicas idempotentes

lib/
└── supabase/
    └── admin.ts                        # ya existe; usado por services

tests/
├── unit/inventory/availability.test.ts
└── integration/inventory/
    ├── reserve.integration.test.ts
    ├── confirm-release-idempotency.integration.test.ts
    ├── concurrency.integration.test.ts
    └── rls.integration.test.ts
```

No se crea `src/`. Los imports usan el alias `@/` (por ejemplo `@/lib/supabase/admin`, `@/features/inventory/...`).

---

## Data Model

### `public.inventory_levels`

Nivel de stock por variante vendible (FR-001, FR-002). Una fila por `variant_id` (único).

```sql
create table public.inventory_levels (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null unique
                      references public.product_variants(id) on delete cascade,
  quantity          integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  updated_at        timestamptz not null default now()
);
```

- `quantity`: existencia física/lógica actual.
- `reserved_quantity`: porción comprometida por reservas activas.
- Invariante implícito verificado por funciones: `reserved_quantity <= quantity`. Se refuerza con `check (reserved_quantity <= quantity)` en la tabla para que ninguna ruta de escritura lo viole (SC-001, SC-002).
- `available = quantity - reserved_quantity` (FR-003), expuesto por vista/función, nunca almacenado.

### `public.inventory_movements`

Historial cronológico y auditable (FR-006, FR-007, FR-008).

```sql
create table public.inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references public.product_variants(id),
  quantity      integer not null check (quantity <> 0),
  movement_type text not null check (
                  movement_type in
                  ('purchase','sale','reservation','release','adjustment','return')
                ),
  reference_id  uuid,
  note          text,
  created_at    timestamptz not null default now()
);
```

- Signo de `quantity`: positivo para entradas (`purchase`, `return`, `adjustment` positivo, `release` de reserva) y negativo para salidas (`sale`, `reservation`). La semántica exacta se documenta en el comentario de cada función.
- `reference_id`: identificador de negocio (`order_id` en checkout/pagos; `null` en ajustes manuales sin referencia). Habilita idempotencia y conciliación.
- Índice de historial: `create index on public.inventory_movements (variant_id, created_at desc);`
- Índice de idempotencia (ver estrategia):

```sql
create unique index inventory_movements_idempotency_idx
  on public.inventory_movements (variant_id, movement_type, reference_id)
  where reference_id is not null
    and movement_type in ('reservation','sale','release');
```

### Vista de disponibilidad

```sql
create view public.variant_availability
with (security_invoker = true) as
select
  il.variant_id,
  il.quantity,
  il.reserved_quantity,
  (il.quantity - il.reserved_quantity) as available,
  il.updated_at
from public.inventory_levels il;
```

---

## Contracts

### Funciones SQL (RPC)

Todas son `security definer`, con `set search_path = ''` y nombres totalmente calificados. Se revoca `EXECUTE` de `public`, `anon` y `authenticated`, y se otorga únicamente a `service_role` (FR-010).

```sql
-- Reserva unidades de una variante. Bloquea la fila con FOR UPDATE, valida
-- disponible >= p_quantity y registra un movimiento 'reservation' negativo.
-- Lanza excepción si no hay disponibilidad suficiente (FR-005).
create or replace function public.reserve_inventory(
  p_variant_id   uuid,
  p_quantity     integer,
  p_reference_id uuid
) returns public.inventory_levels
language plpgsql security definer set search_path = '' as $$ ... $$;

-- Crea el pedido y reserva todas sus variantes en una sola transacción.
-- Pertenece al límite 004-checkout-orders; la firma definitiva de la
-- persistencia del pedido se fija en specs/004-checkout-orders/plan.md.
-- Internamente invoca public.reserve_inventory por cada línea.
create or replace function public.create_checkout_order(
  p_payload jsonb
) returns uuid  -- order_id
language plpgsql security definer set search_path = '' as $$ ... $$;

-- Convierte la reserva de una orden en venta: por cada línea decrementa
-- quantity y reserved_quantity e inserta un movimiento 'sale' con
-- reference_id = p_order_id. Idempotente: si ya existe 'sale' para la
-- referencia, no hace nada (FR-009, SC-004).
create or replace function public.confirm_order_inventory(
  p_order_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$ ... $$;

-- Libera la reserva de una orden: decrementa reserved_quantity e inserta
-- un movimiento 'release' con reference_id = p_order_id. Idempotente y no-op
-- si la orden ya fue confirmada o liberada (FR-009, SC-004).
create or replace function public.release_order_inventory(
  p_order_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$ ... $$;
```

Grants:

```sql
revoke execute on function
  public.reserve_inventory(uuid, integer, uuid),
  public.create_checkout_order(jsonb),
  public.confirm_order_inventory(uuid),
  public.release_order_inventory(uuid)
from public, anon, authenticated;

grant execute on function
  public.reserve_inventory(uuid, integer, uuid),
  public.create_checkout_order(jsonb),
  public.confirm_order_inventory(uuid),
  public.release_order_inventory(uuid)
to service_role;
```

### Queries de disponibilidad (TypeScript)

```ts
// features/inventory/types/inventory.types.ts
export type MovementType =
  | 'purchase' | 'sale' | 'reservation' | 'release' | 'adjustment' | 'return'

export interface InventoryLevel {
  id: string
  variantId: string
  quantity: number
  reservedQuantity: number
  updatedAt: string
}

export interface VariantAvailability {
  variantId: string
  quantity: number
  reservedQuantity: number
  available: number
  updatedAt: string
}
```

```ts
// features/inventory/queries/get-variant-availability.ts
export function getVariantAvailability(
  variantId: string,
): Promise<VariantAvailability | null>

// features/inventory/queries/get-variants-availability.ts
export function getVariantsAvailability(
  variantIds: string[],
): Promise<VariantAvailability[]>
```

```ts
// features/inventory/services/*.ts
export function reserveInventory(
  input: { variantId: string; quantity: number; referenceId: string },
): Promise<InventoryLevel>

export function createCheckoutOrder(payload: unknown): Promise<string> // order_id

export function confirmOrderInventory(orderId: string): Promise<void>

export function releaseOrderInventory(orderId: string): Promise<void>
```

Las `queries` leen la vista `variant_availability` con el cliente público de servidor (RLS permite `SELECT`). Los `services` usan `createAdminClient()` (RPC privilegiado) y no se importan desde componentes de cliente.

---

## Concurrency / Idempotency Strategy

### Atomicidad y anti-overselling

- Toda escritura de `inventory_levels` pasa por funciones `SECURITY DEFINER` dentro de una única transacción de base de datos (ARCHITECTURE.md §17).
- `reserve_inventory` ejecuta `select ... from public.inventory_levels where variant_id = p_variant_id for update`, bloquea la fila y recién entonces valida `quantity - reserved_quantity >= p_quantity`. No se permite el patrón leer-calcular-escribir en la aplicación.
- `create_checkout_order` bloquea las variantes del pedido en orden determinista (`order by variant_id`) para evitar deadlocks entre checkouts concurrentes que comparten variantes.
- Defensa en profundidad: constraints `quantity >= 0`, `reserved_quantity >= 0` y `reserved_quantity <= quantity`. Aunque una función tuviera un error, la transacción falla en vez de persistir un estado inválido (SC-001, SC-002).
- `confirm_order_inventory` decrementa `quantity` y `reserved_quantity` en la misma operación, de modo que `available` no cambia al confirmar una reserva ya existente.

### Idempotencia

- La tabla `inventory_movements` es la fuente de auditoría y de detección de duplicados (ARCHITECTURE.md §18).
- El índice único parcial `(variant_id, movement_type, reference_id)` garantiza como máximo un movimiento `reservation`, un `sale` y un `release` por variante y referencia de negocio.
- `confirm_order_inventory`: si ya existe un `sale` con `reference_id = p_order_id`, retorna sin efectos (no vuelve a descontar stock). El insert del movimiento usa `on conflict do nothing` sobre el índice de idempotencia.
- `release_order_inventory`: si ya existe un `release` o un `sale` para `p_order_id`, retorna sin efectos. No libera reservas inexistentes (edge case de la spec).
- `reference_id` es obligatorio en reserva/confirmación/liberación; los ajustes manuales pueden llevarlo nulo y no participan del índice de idempotencia.
- La expiración automática de reservas no está especificada como comportamiento obligatorio (Assumptions de la spec). En v1 la liberación es explícita desde cancelación de checkout o pago rechazado; no se introduce un job de expiración.

### RLS y autorización (FR-010)

- `inventory_levels`: RLS habilitado. Política `SELECT` para `anon` y `authenticated` (la disponibilidad es información pública de compra). Sin políticas de `INSERT`/`UPDATE`/`DELETE`: quedan denegadas por defecto.
- `inventory_movements`: RLS habilitado sin políticas para `anon`/`authenticated`; solo `service_role` (que ignora RLS) y el backend pueden leerlos. US3 es una capacidad de operador.
- Las funciones de escritura no son invocables por clientes: `EXECUTE` revocado de `anon`/`authenticated` y otorgado solo a `service_role`. Esto evita que un cliente llame a una función `SECURITY DEFINER` para modificar stock saltándose RLS.

---

## Phases

### Fase 0 — Preparación
- Instalar y configurar Vitest (unit + integración) y Playwright (e2e), y los scripts `test`, `typecheck` en `package.json`.
- Definir el entorno de test aislado (Postgres/Supabase local o contenedor) y la forma de aplicar migraciones limpias.
- Generar/actualizar `types/database.types.ts` a partir del esquema.

### Fase 1 — Esquema
- Migración `inventory_schema.sql`: tablas, constraints, FKs e índices (incluido el índice de idempotencia).
- Migración `inventory_rls.sql`: `enable row level security`, políticas y vista `variant_availability`.

### Fase 2 — Funciones atómicas
- Migración `inventory_functions.sql`: `reserve_inventory`, `create_checkout_order`, `confirm_order_inventory`, `release_order_inventory`, grants y `revoke`.

### Fase 3 — Capa TypeScript
- `features/inventory/types`, `queries` y `services` con el alias `@/`.
- Manejo de errores: traducir excepciones de disponibilidad insuficiente a un error de dominio estable; no filtrar detalles internos ni secretos.

### Fase 4 — Integración con checkout y pagos
- Invocar `create_checkout_order` desde el flujo server-side de `004-checkout-orders`.
- Invocar `confirm_order_inventory` desde la reconciliación de pago aprobado (`005-payments`).
- Invocar `release_order_inventory` desde cancelación de checkout / pago rechazado.

### Fase 5 — Tests (constitución §V)
- Unit: cálculo de disponibilidad (`quantity - reserved_quantity`), incluido el caso disponible `0` y negativo imposible.
- Integración: reserva feliz, reserva rechazada por disponibilidad insuficiente (FR-005).
- Concurrencia: dos reservas simultáneas sobre la última unidad no sobrevenden (SC-001, SC-002).
- Idempotencia: doble `confirm_order_inventory` y doble `release_order_inventory` dejan un único efecto (SC-004, FR-009).
- RLS: cliente anónimo/autenticado no puede escribir inventario ni ejecutar las funciones de escritura (FR-010).

### Fase 6 — Observabilidad y cierre
- Logs estructurados con `correlation_id`, `variant_id`/`order_id` y códigos de operación (`inventory.reserve`, `inventory.confirm`, `inventory.release`) sin datos sensibles.
- Validar lint/typecheck/tests/build y migración desde base limpia.

---

## Risks

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Deadlock al reservar múltiples variantes en checkouts concurrentes | Checkout falla | Bloquear filas en orden determinista por `variant_id` dentro de `create_checkout_order`. |
| `SECURITY DEFINER` con `search_path` no fijo | Escalada de privilegios / resolución de objetos inesperada | `set search_path = ''` y nombres totalmente calificados en todas las funciones. |
| Cliente invoca funciones de escritura por RPC | Modificación arbitraria de stock (viola FR-010) | `EXECUTE` revocado de `anon`/`authenticated`, solo `service_role`; RLS sin políticas de escritura. |
| Fuga de `SUPABASE_SECRET_KEY` al bundle | Compromiso total de datos | `lib/supabase/admin.ts` con `import 'server-only'`; nunca importar `services` desde Client Components. |
| Idempotencia incompleta ante reintentos de webhook | Doble descuento de stock (SC-004) | Índice único parcial + `reference_id` + chequeo no-op en confirm/release. |
| Ausencia de infraestructura de tests | No se puede demostrar §V | Fase 0 instala Vitest/Playwright y entorno aislado antes de implementar. |
| Expiración de reservas no especificada | Reservas que quedan tomadas | Fuera de alcance v1; liberación explícita. Documentado en Assumptions y en Out of scope. |

---

## Out of scope

- Múltiples depósitos o ubicaciones de inventario (`inventory_locations`).
- Pronóstico de demanda, compras a proveedores y reposición automática.
- Job automático de expiración de reservas (la spec no fija un tiempo de expiración).
- Edición de catálogo, precios o variantes (módulo 001).
- Persistencia del pedido, snapshots y estados (módulo 004).
- Integración con el proveedor de pago y validación de webhooks (módulo 005).
- UI de administración de inventario y ajustes manuales operativos.
