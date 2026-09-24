# Plan técnico: Checkout y pedidos (`004-checkout-orders`)

Feature Branch: `004-checkout-orders`

Referencias de gobierno:
- `.specify/memory/constitution.md` v1.0.0 (principios I–VII)
- `ARCHITECTURE.md` (server-first, transacciones, snapshots, idempotencia, RLS, secretos)
- `specs/004-checkout-orders/spec.md` (FR-001..FR-010, SC-001..SC-004)
- Dependencias: `specs/001-catalog/spec.md`, `specs/002-customers/spec.md`,
  `specs/003-cart/spec.md`, `specs/006-inventory/spec.md`, `specs/009-promotions/spec.md`

Status: Draft

---

## 1. Summary

Este plan convierte un carrito válido en un **pedido persistente e inmutable** con líneas
históricas (snapshot), dirección histórica, totales coherentes y estados separados de pedido,
pago y fulfillment (FR-001..FR-010).

La creación del pedido, el snapshot de las líneas y la **reserva de inventario** ocurren en una
**única función PostgreSQL transaccional** `create_checkout_order(...)`, invocada vía RPC con el
cliente administrativo server-only. El precio, el stock y el total se recalculan **siempre
server-side**; el navegador nunca es fuente de verdad de importes ni de disponibilidad
(constitución §II/§III/§VI, `ARCHITECTURE.md` §7.3, §11, §17, §18).

El endpoint público `POST /api/checkout` es un **Route Handler delgado**: valida forma, resuelve
identidad/sesión y delega en el service de checkout, que a su vez invoca la función transaccional.

---

## 2. Technical Context

| Aspecto | Decisión |
|---|---|
| Lenguaje | TypeScript estricto (`"strict": true`) |
| Framework | Next.js 16 App Router, React Server Components por defecto |
| Runtime del endpoint | Node.js (Route Handler), sin estado en memoria |
| Datos | Supabase PostgreSQL como sistema de registro |
| Acceso a datos | `lib/supabase/server.ts` (sesión/RLS) y `lib/supabase/admin.ts` (server-only, bypass de RLS) |
| Validación | Zod en el borde (`features/checkout/schemas`) |
| Tipos de DB | `types/database.types.ts` (generados desde el esquema) |
| Atomicidad | Función PostgreSQL `create_checkout_order(...)` + RPC |
| Migraciones | Versionadas en `supabase/migrations/` (constitución §III) |
| Estructura | **Root-based**, alias `@/*`, sin carpeta `src/` (ver nota en §4) |
| Testing | Vitest (unit/integration) + Playwright (E2E). Pendiente de incorporar al repo (ver Gaps) |
| Deploy | Vercel (preview/producción), migraciones fuera del build de frontend |
| Variables de entorno | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL` |

Restricciones heredadas relevantes:
- Dinero en `numeric(12,2)`, nunca `float`; moneda explícita (`ARS`) — `ARCHITECTURE.md` §11.5.
- Los `order_items` son una fotografía histórica: `sku`, `product_name`, `variant_description`,
  `unit_price`, `quantity`, `line_total` — `specs/base.md` §12.
- `orders` mantiene separados `status`, `payment_status` y `fulfillment_status` — FR-005,
  `ARCHITECTURE.md` §11.3.
- Los estados de negocio son hechos del dominio; los movimientos de inventario dejan rastro
  auditable (`ARCHITECTURE.md` §19, constitución §VI).

---

## 3. Constitution Check

| Principio | Estado | Justificación |
|---|---|---|
| **I. Spec-Driven Modular Architecture** | **Pass** | El comportamiento implementado proviene de FR-001..FR-010 y SC-001..SC-004. La lógica vive en `features/checkout` y `features/inventory`; `app/` solo compone la ruta HTTP. Dependencias con 001/002/003/006/009 son explícitas y acíclicas (checkout depende de contratos estables, no al revés). |
| **II. Next.js Server-First Application** | **Pass** | El endpoint es un Route Handler delgado; el cálculo y la mutación viven en services server-only. Ninguna regla de negocio en Client Components. El dominio no depende de React (servicios + SQL). |
| **III. Supabase Data Integrity & Security** | **Pass** | Una sola función PostgreSQL transaccional crea pedido + líneas snapshot + dirección + reserva de inventario + conversión de carrito. Migración versionada. RLS con lectura propia; mutaciones por `service_role`. Constraints: FKs, unicidad de `idempotency_key`, `total >= 0`, `quantity > 0`, enums por `check`. |
| **IV. Secure Boundaries & Secrets** | **Pass** | `lib/supabase/admin.ts` importa `server-only`; `SUPABASE_SECRET_KEY` (sin `NEXT_PUBLIC_`). La identidad se obtiene de la sesión verificada, nunca de un `user_id` del cliente. Los logs no incluyen secretos ni datos de pago. |
| **V. Test-Backed Quality** | **Gaps** | El repo aún no tiene runner de tests ni scripts (`package.json` solo define `dev`/`build`/`start`). Se planifican tests de idempotencia, stock insuficiente, snapshots y RLS. *Mitigación:* incluidos como tareas bloqueantes de release en `tasks.md` (T-fases 6). No hay excepción a la constitución: la feature no se considera terminada sin ellos. |
| **VI. Idempotent Commerce & Integration Workflows** | **Pass** | `orders.idempotency_key` con restricción única; la función detecta reintentos y devuelve el pedido existente sin volver a reservar stock. Snapshots de precio/SKU/nombre/variante/dirección. Reservas y movimientos de inventario con `reference_id` auditable. |
| **VII. Observable, Performant, Accessible Delivery** | **Gaps** | La observabilidad del flujo aún no existe en el repo. *Mitigación:* logs estructurados con `request_id`/`order_id` y código de operación estable, sin PII sensible; el endpoint devuelve mensajes accesibles. Presupuesto: la operación crítica de checkout debe ser corta y transaccional. |

Resultado: el plan es implementable. Los dos *Gaps* (V y VII) están cubiertos por tareas
explícitas y no habilitan ninguna excepción permanente.

---

## 4. Project Structure

Estructura **root-based** (sin `src/`), alineada al repositorio actual. El diagrama de
`ARCHITECTURE.md` §6 muestra `src/`; la convención vigente del repo es root-based con alias `@/*`
(ver `tsconfig.json`). Esta diferencia es de layout, no de arquitectura.

```text
app/
└── api/
    └── checkout/
        └── route.ts                 # Route Handler delgado: valida, resuelve sesión, delega

features/
├── checkout/
│   ├── schemas/
│   │   ├── checkout.schema.ts       # Zod: request de checkout, direcciones, cupón, idempotencyKey
│   │   └── checkout-error.ts        # Códigos de error estables del borde
│   ├── services/
│   │   └── checkout-service.ts      # Orquesta: valida buyability, recalcula, invoca RPC
│   ├── queries/
│   │   ├── get-order.ts             # Lectura de un pedido propio (RLS, sesión)
│   │   └── list-orders.ts           # Historial propio (RLS, paginado)
│   └── types/
│       ├── checkout.types.ts        # Contratos internos de entrada/salida
│       └── order.types.ts           # Order, OrderItem, OrderAddress (dominio)
├── inventory/
│   ├── services/
│   │   └── inventory-service.ts     # Disponibilidad y traducción de error de reserva
│   └── types/
│       └── inventory.types.ts       # InventoryLevel, InventoryMovement, disponibilidad
└── ...

lib/
├── env.ts                           # Acceso centralizado a env (ya existe)
├── supabase/
│   ├── server.ts                    # Cliente con sesión/RLS (ya existe)
│   ├── browser.ts                   # Cliente navegador (ya existe)
│   └── admin.ts                     # Cliente server-only con secret key (ya existe)
└── errors/
    └── checkout-error.ts            # Mapa de errores de dominio → status HTTP

types/
└── database.types.ts                # Tipos generados del esquema

supabase/
└── migrations/
    ├── 0004_orders.sql              # orders, order_items, order_addresses + constraints + RLS
    └── 0005_checkout_order_function.sql  # create_checkout_order(...) (SECURITY DEFINER)
```

Dependencias de migración: `0004_orders.sql`/`0005_...` asumen que existen `profiles`,
`product_variants`, `products`, `inventory_levels`, `inventory_movements` y `carts`
(001/002/003/006). El orden de migraciones debe respetar esa precedencia.

---

## 5. Data Model

### 5.1. `orders` (nueva / ajuste de `specs/base.md` §11)

Representa el pedido. Mantiene tres estados independientes (FR-005) y los totales históricos
(FR-004).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `order_number` | `bigint generated always as identity unique` | Número legible |
| `user_id` | `uuid null references profiles(id) on delete set null` | Nulo en pedidos de invitado (FR-007) |
| `email` | `text not null` | Obligatorio incluso sin perfil (FR-007) |
| `status` | `text not null default 'pending'` | `pending, confirmed, processing, shipped, completed, cancelled, refunded` |
| `payment_status` | `text not null default 'pending'` | `pending, approved, rejected, refunded, cancelled` |
| `fulfillment_status` | `text not null default 'unfulfilled'` | `unfulfilled, processing, packed, shipped, delivered, returned` |
| `currency` | `text not null default 'ARS'` | |
| `subtotal` | `numeric(12,2) not null check (subtotal >= 0)` | |
| `discount_total` | `numeric(12,2) not null default 0 check (discount_total >= 0)` | |
| `shipping_total` | `numeric(12,2) not null default 0 check (shipping_total >= 0)` | |
| `tax_total` | `numeric(12,2) not null default 0 check (tax_total >= 0)` | |
| `total` | `numeric(12,2) not null check (total >= 0)` | `total = subtotal - discount_total + shipping_total + tax_total` |
| `idempotency_key` | `text null unique` | Clave de idempotencia del checkout (FR-010) |
| `customer_note` | `text null` | |
| `created_at` / `updated_at` | `timestamptz not null default now()` | |

Invariantes codificadas en DB: `total >= 0`, componentes no negativos, estados válidos por `check`.

### 5.2. `order_items` (nueva — snapshot histórico, FR-002)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid pk` | |
| `order_id` | `uuid not null references orders(id) on delete cascade` | |
| `product_id` | `uuid null references products(id) on delete set null` | Referencia best-effort; no autoridad histórica |
| `variant_id` | `uuid null references product_variants(id) on delete set null` | |
| `sku` | `text` | Snapshot |
| `product_name` | `text not null` | Snapshot |
| `variant_description` | `text` | Snapshot |
| `unit_price` | `numeric(12,2) not null check (unit_price >= 0)` | Snapshot |
| `quantity` | `int not null check (quantity > 0)` | |
| `line_total` | `numeric(12,2) not null check (line_total >= 0)` | `= unit_price * quantity` |
| `created_at` | `timestamptz not null default now()` | |

El histórico no depende del catálogo actual (FR-002, FR-009, SC-002).

### 5.3. `order_addresses` (nueva — snapshot de dirección, FR-003)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid pk` | |
| `order_id` | `uuid not null references orders(id) on delete cascade` | |
| `address_type` | `text not null check (address_type in ('shipping','billing'))` | |
| `recipient_name` | `text not null` | |
| `address_line1` | `text not null` | |
| `address_line2` | `text null` | |
| `city` / `state` / `postal_code` / `country` / `phone` | `text` | `country` con default apropiado |
| `unique (order_id, address_type)` | | Una dirección por tipo |

### 5.4. Reutiliza (sin cambios de propiedad)

- `inventory_levels` (`quantity`, `reserved_quantity`) y `inventory_movements`
  (`movement_type in ('reservation','release','sale',...)`, `reference_id`) — 006.
- `carts` / `cart_items` — 003; el checkout marca el carrito como `converted` en la misma
  transacción (SC-003 de 003).
- `coupons` / `coupon_redemptions` — 009; el descuento se resuelve antes de crear el pedido y se
  persiste el importe efectivo (FR-004 de 004, FR-007/FR-009 de 009).

### 5.5. RLS

| Tabla | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `orders` | — | `SELECT` solo `user_id = auth.uid()` (FR-008, SC-003) | bypass (mutaciones) |
| `order_items` | — | `SELECT` si su `order` pertenece al usuario | bypass |
| `order_addresses` | — | `SELECT` si su `order` pertenece al usuario | bypass |

No se conceden `INSERT`/`UPDATE`/`DELETE` a `anon` ni a `authenticated`: toda mutación pasa por
`service_role` a través de la función transaccional (constitución §III, `AGENTS.md` §11).
Los pedidos de invitado (`user_id is null`) no son legibles por RLS autenticada; su consulta
posterior por token/email queda fuera de este plan.

---

## 6. Contracts

### 6.1. `POST /api/checkout`

Route Handler delgado en `app/api/checkout/route.ts`. Requiere sesión válida o carrito de sesión
anónima; para invitado exige `email`.

**Request** (`Content-Type: application/json`)

```jsonc
{
  "idempotencyKey": "3f1c...-uuid",   // obligatorio; identifica la intención de confirmación
  "cartId": "uuid",                    // obligatorio; el servidor lee las líneas de la DB
  "email": "comprador@ejemplo.com",    // obligatorio si no hay perfil; opcional si autenticado
  "shippingAddress": {
    "recipientName": "Ana Pérez",
    "addressLine1": "Av. Siempre Viva 123",
    "addressLine2": null,
    "city": "CABA",
    "state": "CABA",
    "postalCode": "1406",
    "country": "AR",
    "phone": "+54 11 5555 5555"
  },
  "billingAddress": { /* misma forma */ }, // opcional; si falta, se usa la de envío
  "couponCode": "PROMO10",              // opcional
  "customerNote": "Entregar por la tarde" // opcional
}
```

No se aceptan `unit_price`, `line_total`, `subtotal` ni `total` enviados por el cliente: se
ignoran o se rechazan por validación. El precio y el stock salen de la base.

**Response 201 Created** (o **200 OK** en reintento idempotente)

```jsonc
{
  "order": {
    "id": "uuid",
    "orderNumber": 1042,
    "status": "pending",
    "paymentStatus": "pending",
    "fulfillmentStatus": "unfulfilled",
    "currency": "ARS",
    "subtotal": "25000.00",
    "discountTotal": "0.00",
    "shippingTotal": "0.00",
    "taxTotal": "0.00",
    "total": "25000.00",
    "createdAt": "2026-09-20T12:00:00.000Z"
  },
  "lines": [
    {
      "productName": "Remera Oversize",
      "variantDescription": "Negra / L",
      "sku": "OV-BLK-L",
      "unitPrice": "25000.00",
      "quantity": 1,
      "lineTotal": "25000.00"
    }
  ],
  "idempotentReplay": false
}
```

**Errores** (código estable + status)

| Status | `code` | Causa |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body inválido según Zod |
| 401 | `UNAUTHENTICATED` | Se requiere identidad y no hay sesión |
| 403 | `FORBIDDEN` | El carrito no pertenece a la identidad/sesión |
| 409 | `CART_ALREADY_CONVERTED` | El carrito ya fue convertido (SC-003 de 003) |
| 409 | `ITEM_NOT_BUYABLE` | Variante inactiva/archivada o producto no vendible (FR-006) |
| 409 | `INSUFFICIENT_STOCK` | Disponibilidad < cantidad solicitada (FR-006) |
| 422 | `EMPTY_CART` | Carrito sin líneas válidas |
| 422 | `COUPON_INVALID` | Cupón vencido/inelegible (009) |
| 422 | `INVALID_TOTAL` | Total negativo o inconsistente (Edge cases de la spec) |
| 500 | `INTERNAL_ERROR` | Fallo de infraestructura/DB |

Reglas del contrato:
- Un reintento con el mismo `idempotencyKey` **no crea** un segundo pedido (FR-010, SC-004);
  devuelve el pedido existente con `idempotentReplay: true`.
- La reserva de stock y la creación del pedido son atómicas: si falla cualquiera, no persiste nada.
- Los importes viajan como string decimal (no `number`) para preservar precisión.

---

## 7. Sequence / flow de checkout

```text
Cliente (Client/Server Component)
      │  POST /api/checkout  { idempotencyKey, cartId, email, addresses, couponCode }
      ▼
app/api/checkout/route.ts            (Route Handler delgado)
      │  1. Parse + Zod (features/checkout/schemas/checkout.schema.ts)
      │  2. Resolver identidad desde la sesión (lib/supabase/server.ts)
      │  3. Resolver cartId y ownership
      ▼
features/checkout/services/checkout-service.ts
      │  4. Verificar si ya existe pedido para idempotencyKey  ──► si existe: 200 replay
      │  5. Verificar buyability de cada variante (001: status, is_active)
      │  6. Delegar el cálculo autoritativo a la función transaccional
      ▼
create_checkout_order(...)  [RPC con lib/supabase/admin.ts]  ── una transacción
      │  a. Lock de carrito / idempotencia (idempotency_key UNIQUE)
      │  b. Lock de inventory_levels de las variantes (SELECT ... FOR UPDATE)
      │  c. Revalidar available = quantity - reserved_quantity >= qty   (FR-006)
      │  d. Leer price, name, sku, variant_description server-side (FR-002, FR-004)
      │  e. Calcular subtotal, descuento (009), envío/impuestos, total  (FR-004)
      │  f. INSERT orders (tres estados, totales, email)               (FR-001, FR-005, FR-007)
      │  g. INSERT order_items (snapshot por línea)                    (FR-002)
      │  h. INSERT order_addresses (shipping y billing snapshot)       (FR-003)
      │  i. UPDATE inventory_levels.reserved_quantity += qty           (006)
      │         + INSERT inventory_movements (type='reservation', reference_id=order.id)
      │  j. UPDATE carts SET status='converted'
      │  k. COMMIT
      ▼
Route Handler responde 201 (o 200 replay) con order + lines
```

Cualquier error de dominio dentro de la transacción provoca rollback total: no hay pedido
parcial, ni stock reservado sin pedido, ni pedido sin líneas (SC-001).

---

## 8. Fases

1. **Fase 0 — Preparación**
   Confirmar precedencia de migraciones (001/002/003/006 ya aplicables), incorporar `types/database.types.ts`
   y runner de tests. Sin migrar nada manualmente.

2. **Fase 1 — Esquema y RLS (FR-001..FR-005, FR-008)**
   `supabase/migrations/0004_orders.sql`: tablas `orders`, `order_items`, `order_addresses`,
   constraints, índices y políticas RLS de lectura propia. Sin `INSERT/UPDATE/DELETE` para clientes.

3. **Fase 2 — Función transaccional e idempotencia (FR-006, FR-010; 006 §V)**
   `supabase/migrations/0005_checkout_order_function.sql`: `create_checkout_order(...)`
   con locks, reserva atómica, creación de pedido/líneas/dirección, movimiento de inventario y
   conversión de carrito. `SECURITY DEFINER` con `search_path` controlado; invocable solo por
   `service_role`.

4. **Fase 3 — Dominio y acceso a datos (FR-002..FR-006)**
   `features/checkout/{schemas,types,services,queries}` y `features/inventory/{services,types}`.
   `checkout-service` orquesta validación, idempotencia y RPC; `inventory-service` traduce
   disponibilidad y errores de reserva.

5. **Fase 4 — Endpoint HTTP**
   `app/api/checkout/route.ts` + `lib/errors/checkout-error.ts`: mapa de errores a status,
   validación Zod, autenticación/autorización, respuesta 201/200.

6. **Fase 5 — Lectura de pedidos (FR-008, SC-003)**
   `features/checkout/queries/get-order.ts` y `list-orders.ts` usando el cliente con sesión/RLS.

7. **Fase 6 — Tests (constitución §V)**
   Unit: cálculo de totales, mapeo de errores, validación Zod. Integración: idempotencia de
   checkout, stock insuficiente, snapshots, RLS (pedido ajeno inaccesible), rollback.
   E2E Playwright: carrito → checkout → confirmación.

8. **Fase 7 — Observabilidad y cierre**
   Logs estructurados con `request_id`/`order_id`/`code`, sin secretos ni PII innecesaria.
   Revisión de convergencia y Definition of Done (`AGENTS.md` §14).

---

## 9. Risks

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Overselling por concurrencia | Stock/reservas inconsistentes | Lock `FOR UPDATE` + check de disponibilidad dentro de la misma transacción (006 SC-001/SC-002) |
| Reintentos del navegador duplican pedidos | Pedidos y reservas duplicadas | `idempotency_key` único + detección de replay antes de reservar (FR-010, SC-004) |
| Confianza en precios/stock del cliente | Cobro incorrecto | Recalcular server-side; ignorar campos de importe del request |
| Totales negativos o incoherentes | Violación de edge cases | Constraints `>= 0` + validación de `total` en la función |
| `SUPABASE_SECRET_KEY` filtrada | Compromiso total de datos | `server-only` en `lib/supabase/admin.ts`; RPC solo por `service_role` |
| Migraciones no reproducibles en preview | Fallo de despliegue | Migraciones versionadas y `supabase test db`; migración fuera del build de frontend |
| Acoplamiento prematuro con 009 (cupones) y 005 (pagos) | Scope creep | Checkout persiste importes y estados; no procesa pagos ni recalcula cupones históricos |
| Ausencia de runner de tests | Sin red de seguridad | Incorporar Vitest/Playwright como tareas bloqueantes antes de “Done” |
| Pedidos de invitado sin retrieval | Cliente no consulta su pedido | Documentado como fuera de alcance; se resuelve con token/email en una iteración posterior |

---

## 10. Out of scope

- Procesamiento del pago y webhooks: pertenece a `005-payments`.
- Envío, tracking y estados logísticos: pertenece a `008-shipping`.
- Personalizaciones de diseño en líneas de pedido: pertenece a `007-designs`
  (`order_item_customizations`).
- Administración de pedidos desde back-office (cambios de estado manuales, reembolsos,
  cancelaciones operativas).
- Motor fiscal o régimen impositivo específico: `tax_total` solo se persiste.
- Multi-moneda y múltiples depósitos de inventario.
- Recuperación de pedidos de invitado sin cuenta (token/email) queda para una iteración posterior.
- Notificaciones transaccionales por email.