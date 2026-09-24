# Plan Técnico: Carrito de compra (003-cart)

Feature Branch: `003-cart`
Spec: [`spec.md`](./spec.md)
Fecha: 2026-09-20
Estado: Draft

Referencias de gobierno:
- `.specify/memory/constitution.md` v1.0.0 (principios I–VII), con foco en §II (server-first),
  §III (RLS/integridad), §IV (secretos) y §VI (idempotencia).
- `ARCHITECTURE.md` (server-first, Server Functions para mutaciones de UI, RLS, idempotencia,
  migraciones versionadas).
- `specs/003-cart/spec.md` (FR-001..FR-009, SC-001..SC-004).
- Dependencias: `specs/001-catalog/spec.md` (variantes vendibles), `specs/002-customers/spec.md`
  (invitado vs autenticado), `specs/004-checkout-orders/spec.md` y `specs/005-payments/spec.md`.

Este plan traduce la especificación funcional del carrito a decisiones técnicas concretas. Respeta
las decisiones ya fijadas a nivel proyecto y **no introduce comportamiento ausente en `spec.md`**.

---

## 1. Summary

El carrito es la capacidad que permite **preparar una compra antes del checkout**: seleccionar
variantes del catálogo con cantidades, modificarlas o eliminarlas, y persistirlas tanto para un
cliente autenticado como para un visitante anónimo (FR-001).

Alcance técnico:

- Persistencia en las tablas `carts` y `cart_items` (`specs/base.md` §10) más una columna
  `session_token` en `carts` para carritos anónimos, con índices únicos parciales que garantizan
  **un solo carrito activo** por `user_id` y por `session_token` (FR-001, FR-009).
- Identidad derivada **siempre del servidor**: usuario autenticado por la sesión de Supabase;
  visitante por una cookie `httpOnly` `morchi_cart_token` (uuid) generada en una Server Action.
- Mutaciones como **Server Actions** (`addCartItem`, `updateCartItem`, `removeCartItem`) y lectura
  `getCart` para Server Components. No se construye una API REST para el carrito
  (`ARCHITECTURE.md` §14).
- Validación de comprabilidad al agregar: variante activa + producto activo + disponibilidad
  suficiente (FR-006). La revalidación final y autoritativa ocurre en checkout vía la RPC
  `create_checkout_order` (FR-007, SC-004).
- Ciclo de vida del carrito (`active` / `converted` / `abandoned`): al crear el pedido el carrito se
  marca `converted`, de modo que **no pueda convertirse dos veces** (FR-009, SC-003). La idempotencia
  del checkout se apoya en `orders.idempotency_key` (módulo 004).
- UI: drawer de carrito real en `components/store/cart-drawer.tsx` y página `/checkout` con
  formulario de email. El precio mostrado es **informativo**; el precio definitivo lo fija la RPC en
  el momento de crear el pedido (assumption de la spec).
- Tests unitarios (Vitest), de integración/RLS y E2E (Playwright) según constitución §V.

Fuera de este módulo: conversión de carrito en pedido y cálculo autoritativo de totales (004),
pagos (005), reserva efectiva de stock (006), envíos (008) y promociones (009). Ver §10.

---

## 2. Technical Context

### Lenguaje y runtime

- **TypeScript** obligatorio (strict) sobre **Next.js App Router** (`next@16`, React 19).
- Proyecto **root-based**: no se usa carpeta `src/`. El alias `@/*` apunta a la raíz
  (`tsconfig.json` → `"paths": { "@/*": ["./*"] }`).

### Estructura de proyecto (decidida)

- `app/` expresa rutas y composición de páginas (aquí `app/(store)/checkout/page.tsx`).
- `features/` contiene capacidades de negocio (`features/cart/`, `features/checkout/`).
- `components/store/` contiene componentes de tienda reutilizables (`cart-drawer.tsx`).
- `lib/` contiene infraestructura transversal, incluido `lib/supabase/`.
- `types/database.types.ts` contiene los tipos generados desde el esquema.

### Dependencias relevantes

| Dependencia | Uso |
|---|---|
| `@supabase/ssr` | Cliente SSR con sesión por cookies |
| `@supabase/supabase-js` | Cliente base (admin server-only) |
| `next` | App Router, Server Components, Server Actions, `revalidatePath` |
| `zod` | Validación de inputs de las Server Actions y de los servicios |
| `server-only` | Bloquea el cliente admin en el bundle del navegador |

Aún **no instalados** (se agregan en la fase de Setup): `vitest`, `@playwright/test` y utilidades
asociadas.

### Clientes Supabase

- `lib/supabase/server.ts` → `createClient()`: cliente SSR con cookies; **se usa para resolver la
  identidad autenticada** desde la sesión verificada.
- `lib/supabase/admin.ts` → `createAdminClient()`: **server-only**, usa `SUPABASE_SECRET_KEY` y hace
  bypass de RLS. Las operaciones de carrito se ejecutan con este cliente porque un visitante anónimo
  no tiene una sesión de Supabase que RLS pueda evaluar.
- `lib/supabase/browser.ts` **no** se usa para el carrito: ninguna operación de carrito se ejecuta
  desde el navegador contra la API de Supabase.

> RLS sigue siendo la defensa en profundidad para el acceso directo a `carts`/`cart_items` mediante
> la API de Supabase (constitución §III); el carrito anónimo solo es accesible por `service_role`.

### Identidad y sesión anónima

- **Usuario autenticado:** `supabase.auth.getUser()` sobre el cliente SSR. La identidad **nunca** se
  toma de un `user_id` enviado por el navegador (`ARCHITECTURE.md` §8).
- **Visitante:** cookie `morchi_cart_token` (`httpOnly`, `sameSite: 'lax'`, `secure` en producción,
  `path: '/'`). Se genera con `crypto.randomUUID()` dentro de una **Server Action** (único contexto
  de mutación que puede escribir cookies). No es legible por JavaScript del cliente.

### Variables de entorno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only, sin prefijo `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_SITE_URL` (usado por checkout/pagos)

Acceso centralizado en `lib/env.ts`. Ninguna clave secreta llega al navegador (constitución §IV).

### Testing

- **Vitest** para lógica de dominio aislada: validación de cantidades, resolución de identidad,
  mapeo DB → view model y errores de carrito.
- **Integración/RLS** contra un entorno Supabase aislado: persistencia de carrito anónimo y
  autenticado, unicidad de línea, aislamiento entre usuarios, imposibilidad de leer carritos ajenos.
- **Playwright** para el journey crítico: ver producto → agregar variante → modificar cantidad →
  eliminar → abrir checkout.

### Plataforma objetivo

- **Vercel** para hosting, previews y producción. El build debe pasar typecheck, lint, tests y
  `next build`. Las migraciones Supabase son un proceso controlado independiente del build de
  frontend (`ARCHITECTURE.md` §25).

### Rendimiento y accesibilidad

- Server Components por defecto para renderizar el carrito; el drawer es un Client Component acotado
  a interactividad (apertura, estado local), **sin reglas de negocio** (constitución §II).
- Sin cache compartida para el carrito (`ARCHITECTURE.md` §13: datos específicos de usuario no se
  cachean de forma compartida).
- Revalidación selectiva tras mutaciones (`revalidatePath`), no invalidación global.
- Drawer accesible: labels, operación por teclado, foco visible, mensajes de validación legibles y
  estados de error/éxito no dependientes solo del color (constitución §VII).

---

## 3. Constitution Check

Evaluación de los principios I–VII de `.specify/memory/constitution.md` (v1.0.0).

| Principio | Estado | Justificación |
|---|---|---|
| **I. Spec-Driven Modular Architecture** | ✅ Pass | El plan deriva de `spec.md` (FR-001..FR-009, SC-001..SC-004) y respeta límites de módulo. `features/cart/` no confirma pedidos ni pagos; la conversión y el cálculo autoritativo quedan en `004`/`005`. Las dependencias 001 (variantes), 002 (identidad) y 004/005 (checkout) son explícitas y acíclicas. |
| **II. Next.js Server-First Application** | ✅ Pass | `getCart` se lee en Server Components; `addCartItem`/`updateCartItem`/`removeCartItem` son Server Actions con validación y autorización server-side. El drawer es Client Component solo por interactividad y no contiene reglas de negocio. El dominio vive en `features/cart/services/cart-service.ts`, testeable sin navegador. |
| **III. Supabase Data Integrity & Security** | ✅ Pass | Esquema por migración versionada. Constraints: FK, `unique(cart_id, variant_id)` (FR-003), `check (quantity > 0)` (FR-005), `check (status in (...))` (FR-009), `carts_owner_present`. Índices únicos parciales de carrito activo por `user_id` y por `session_token`. RLS habilitado en `carts`/`cart_items` con políticas explícitas para `authenticated`; el carrito anónimo solo por `service_role`. La identidad se deriva server-side; el cliente nunca aporta un `cart_id`/`user_id` confiable. |
| **IV. Secure Boundaries & Secrets** | ✅ Pass | `lib/supabase/admin.ts` importa `server-only` y usa `SUPABASE_SECRET_KEY` (sin `NEXT_PUBLIC_`). La cookie de sesión anónima es `httpOnly` (no accesible desde JS) y se emite en una Server Action. No se registran tokens de sesión ni secretos en logs. |
| **V. Test-Backed Quality** | ⚠️ Gaps (mitigado) | El repo aún no define runner de tests (`package.json` solo tiene `dev`/`build`/`start`/`typecheck`). Se planifican unit, integración/RLS y E2E como tareas **bloqueantes de release** (Fase 6). No habilita una excepción permanente a la constitución; la feature no se cierra con tests ausentes o fallando. |
| **VI. Idempotent Commerce & Integration Workflows** | ✅ Pass | La creación de línea es un *upsert* que respeta `unique(cart_id, variant_id)`: reintentar “agregar” no duplica la línea (FR-003, SC-001). El carrito pasa a `converted` al crear el pedido y no puede reconvertirse (FR-009, SC-003); la idempotencia del checkout usa `orders.idempotency_key` (004). Los precios mostrados no son autoridad: se congelan al crear el pedido. |
| **VII. Observable, Performant, Accessible Delivery** | ✅ Pass (con gap menor) | Server Components reducen JS; revalidación selectiva; sin cache compartida de carrito. UI accesible (labels, teclado, estados no solo por color). Gap menor: la observabilidad del flujo se apoya en logs estructurados con un código de operación estable, sin PII ni secretos; se lista como tarea en la Fase 7. |

**Gaps / complejidad:** ninguno bloqueante. Las dependencias de testing se incorporan en Setup y la
observabilidad mínima se cierra en la Fase 7. No se documentan excepciones a reglas MUST.

---

## 4. Project Structure

Rutas concretas a crear o editar. Las marcadas con ✏️ ya existen en el repo y se reutilizan.

### Migración y datos

```text
supabase/
├── migrations/
│   └── 20260920000007_cart.sql   ✏️  # carts + session_token + cart_items + índices + RLS
└── tests/
    └── cart_rls.test.sql             # tests SQL de RLS (permitido/denegado)
types/
└── database.types.ts                 # tipos generados (regenerar tras migración)
```

> La migración `20260920000007_cart.sql` ya está presente en el repo; este plan la toma como base y
> las tareas correspondientes se limitan a **validar/ajustar** constraints, índices y RLS, no a
> recrear el esquema. Cualquier cambio de esquema debe seguir siendo una migración versionada.

### Dominio del carrito

```text
features/cart/
├── types/
│   └── cart.types.ts                 # CartStatus, CartIdentity, CartView, CartLineView, inputs, errores
├── schemas/
│   └── cart.schema.ts                # Zod: AddCartItemInput, UpdateCartItemInput, RemoveCartItemInput
├── services/
│   └── cart-service.ts               # getCart / addCartItem / updateCartItem / removeCartItem (dominio)
└── actions/
    └── cart-actions.ts               # Server Actions: ensureCartSession, addCartItem, updateCartItem, removeCartItem
```

### Integración con checkout

```text
features/checkout/
└── services/
    └── checkout-cart.ts              # checkoutCart(): carga el carrito activo server-side y delega en 004/005
```

### UI

```text
components/store/
└── cart-drawer.tsx                   # Client Component: drawer real (interactividad, sin reglas de negocio)

app/(store)/
└── checkout/
    └── page.tsx                      # Server Component: resumen del carrito + formulario de email
```

### Reutilización (ya existe)

```text
lib/supabase/server.ts   ✏️  # createClient() SSR con sesión (resolución de identidad)
lib/supabase/admin.ts    ✏️  # createAdminClient() server-only (operaciones de carrito)
lib/env.ts               ✏️  # acceso a variables de entorno
components/ui/           ✏️  # primitivas reutilizables (Button, etc.)
app/layout.tsx           ✏️  # layout raíz
```

### Tests

```text
tests/
├── unit/cart/
│   ├── cart-schema.test.ts           # validaciones Zod (cantidad ≥ 1, uuid de variante)
│   ├── cart-identity.test.ts         # resolución de identidad usuario vs. sesión anónima
│   └── cart-totals.test.ts           # subtotal informativo y coherencia con líneas (SC-002)
├── integration/cart/
│   ├── cart-service.test.ts          # alta/modificación/eliminación y unicidad de línea (FR-002..FR-005)
│   ├── cart-anonymous.test.ts        # carrito por session_token, recuperación dentro de la sesión (US3)
│   └── cart-rls.test.ts              # RLS: aislamiento entre usuarios; anon sin acceso a carts/cart_items
└── e2e/cart/
    ├── add-to-cart.spec.ts           # agregar variante y verla en el drawer (SC-001)
    ├── modify-cart.spec.ts           # cambiar cantidad y eliminar (SC-002)
    └── cart-to-checkout.spec.ts      # drawer → /checkout con email (US1/US2)
```

---

## 5. Data Model

Modelo canónico definido en `specs/base.md` §10, con la columna `session_token` agregada para
carritos anónimos (FR-001). Solo se listan las tablas relevantes para el carrito.

### `carts`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `user_id` | `uuid null references profiles(id) on delete cascade` | Presente para cliente autenticado (FR-001) |
| `session_token` | `text null` | Identifica el carrito anónimo por cookie (FR-001) |
| `status` | `text not null default 'active'` | `check in ('active','converted','abandoned')` → FR-009 |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | Trigger `set_updated_at()` |
| — | `constraint carts_owner_present` | `check (user_id is not null or session_token is not null)` |
| — | índice único parcial `carts_user_active_key` (user_id) | `where user_id is not null and status = 'active'` → un carrito activo por usuario (FR-001) |
| — | índice único parcial `carts_session_active_key` (session_token) | `where session_token is not null and status = 'active'` → un carrito activo por sesión anónima (FR-001) |

### `cart_items`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `cart_id` | `uuid not null references carts(id) on delete cascade` | |
| `variant_id` | `uuid not null references product_variants(id)` | La línea se identifica por variante (FR-002) |
| `quantity` | `int not null check (quantity > 0)` | Rechaza cantidades < 1 (FR-005) |
| `created_at` | `timestamptz not null default now()` | |
| — | `unique (cart_id, variant_id)` | Impide líneas activas duplicadas de la misma variante (FR-003, SC-001) |
| — | índice `cart_items_cart_idx` (cart_id) | Lectura eficiente del carrito |

### Invariantes de dominio

- **FR-008:** `cart_items` guarda únicamente `variant_id` y `quantity`. No se copian `name` ni
  `description` del catálogo: el carrito muestra los datos vigentes y el snapshot histórico pertenece
  a `order_items` (módulo 004).
- Un carrito con `status <> 'active'` no admite agregar/modificar/eliminar líneas (FR-009).
- Cambiar el stock del catálogo **no** modifica silenciosamente el carrito: puede dejarlo parcialmente
  inválido y esa situación se comunica en checkout (edge case de la spec, FR-007).
- Un producto archivado puede permanecer visible en un carrito existente solo para permitir una
  resolución explícita antes de comprar (edge case); no puede **agregarse** de nuevo (FR-006).

### RLS

| Tabla | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `carts` | — (sin grant ni policy) | `SELECT`/`INSERT`/`UPDATE` solo si `user_id = auth.uid()` | bypass (carrito anónimo y operaciones server-side) |
| `cart_items` | — (sin grant ni policy) | `SELECT`/`INSERT`/`UPDATE`/`DELETE` solo si el `cart` padre es propio | bypass |

No se concede `DELETE` de `carts` a `authenticated` (el ciclo de vida se expresa por `status`). El
carrito anónimo no es accesible por RLS; se opera exclusivamente con `service_role` desde el servidor
(constitución §III/§IV).

---

## 6. Contracts

### 6.1. Tipos de dominio

```ts
// features/cart/types/cart.types.ts

export type CartStatus = 'active' | 'converted' | 'abandoned'

export type CartIdentity =
  | { kind: 'user'; userId: string }
  | { kind: 'session'; sessionToken: string }

export interface CartLineView {
  id: string
  variantId: string
  quantity: number
  productName: string
  variantDescription: string | null
  sku: string
  unitPrice: number          // informativo; el precio definitivo lo fija checkout
  lineTotal: number          // informativo
}

export interface CartView {
  id: string
  status: CartStatus
  items: CartLineView[]
  subtotal: number           // informativo
  currency: 'ARS'
}

export interface AddCartItemInput {
  variantId: string
  quantity: number
}

export interface UpdateCartItemInput {
  itemId: string
  quantity: number
}

export interface RemoveCartItemInput {
  itemId: string
}

export type CartErrorCode =
  | 'VALIDATION_ERROR'
  | 'VARIANT_NOT_BUYABLE'
  | 'INSUFFICIENT_STOCK'
  | 'CART_ITEM_NOT_FOUND'
  | 'CART_NOT_ACTIVE'

export type CartActionResult =
  | { ok: true; cart: CartView }
  | { ok: false; code: CartErrorCode }
```

### 6.2. Servicio de dominio

Ejecuta las operaciones con el cliente admin (`lib/supabase/admin.ts`) y recibe la identidad **ya
resuelta** por el borde. No depende de React y es testeable de forma aislada.

```ts
// features/cart/services/cart-service.ts
import type {
  AddCartItemInput,
  CartIdentity,
  CartView,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from '@/features/cart/types/cart.types'

/** Devuelve el carrito activo de la identidad, o null si no existe. */
export function getCart(identity: CartIdentity): Promise<CartView | null>

/** Crea o recupera el carrito activo y hace upsert de la línea (FR-001, FR-002, FR-003, FR-006). */
export function addCartItem(input: AddCartItemInput, identity: CartIdentity): Promise<CartView>

/** Cambia la cantidad de una línea propia (FR-004, FR-005). */
export function updateCartItem(input: UpdateCartItemInput, identity: CartIdentity): Promise<CartView>

/** Elimina una línea propia (FR-004). */
export function removeCartItem(input: RemoveCartItemInput, identity: CartIdentity): Promise<CartView>
```

Reglas de contrato:

- `addCartItem` valida server-side que la variante esté activa, el producto `active` y no borrado, y
  que haya disponibilidad suficiente antes de insertar (FR-006). Si la línea ya existe para esa
  variante, incrementa la cantidad en lugar de duplicarla (FR-003, SC-001).
- `updateCartItem` y `removeCartItem` verifican que la línea pertenezca al carrito de la identidad
  resuelta; una línea ajena o inexistente devuelve `CART_ITEM_NOT_FOUND`. `quantity < 1` se rechaza
  como `VALIDATION_ERROR` (FR-005).
- Ninguna función acepta un `cartId`/`userId` provisto por el cliente como autoridad.
- Los importes devueltos son **informativos**; no son autoridad para el cobro (assumption de spec).

### 6.3. Server Actions (borde de mutación)

```ts
// features/cart/actions/cart-actions.ts
'use server'

/** Garantiza la cookie httpOnly `morchi_cart_token` para visitantes (uuid) si aún no existe. */
export function ensureCartSession(): Promise<void>

/** Valida el input con Zod, resuelve identidad, llama al servicio y revalida rutas afectadas. */
export function addCartItem(input: AddCartItemInput): Promise<CartActionResult>
export function updateCartItem(input: UpdateCartItemInput): Promise<CartActionResult>
export function removeCartItem(input: RemoveCartItemInput): Promise<CartActionResult>
```

Reglas de contrato de las Server Actions:

- Resuelven la identidad **en el servidor**: `getUser()` (Sesión Supabase) o la cookie
  `morchi_cart_token`; si no hay ninguna, `ensureCartSession()` genera el token (FR-001).
- Validan la forma con Zod antes de tocar el dominio (constitución §IV, `AGENTS.md` §9.8) y devuelven
  un `CartActionResult` discriminado para errores de dominio esperados, en vez de filtrar detalles
  internos.
- Tras una mutación exitosa revalidan selectivamente las rutas afectadas (drawer, `/checkout`), sin
  invalidación global (`ARCHITECTURE.md` §13).

### 6.4. Servicio de checkout desde el carrito

```ts
// features/checkout/services/checkout-cart.ts
import type { CheckoutCartResult } from '@/features/checkout/types/checkout.types'

export interface CheckoutCartInput {
  email: string
  idempotencyKey?: string
}

/**
 * Carga el carrito activo de la identidad resuelta server-side, lo convierte en pedido
 * (RPC `create_checkout_order`, módulo 004) y genera la preferencia de pago (módulo 005).
 */
export function checkoutCart(input: CheckoutCartInput): Promise<CheckoutCartResult>
```

Reglas de contrato:

- Las líneas se leen de la base a partir de la identidad resuelta; el navegador no envía precios,
  totales ni el contenido del carrito como fuente de verdad (constitución §II/§III).
- La RPC `create_checkout_order` revalida disponibilidad y estado de cada variante y fija los precios
  definitivos (FR-007, SC-004); si algo deja de ser comprable, el checkout falla sin crear pedido.
- Al crear el pedido, el carrito se marca `converted` y no puede reconvertirse (FR-009, SC-003).
- Un reintento con la misma `idempotencyKey` devuelve el pedido existente sin duplicar ni reservar de
  nuevo (`orders.idempotency_key`, módulo 004).

---

## 7. Flujo agregar / modificar / checkout

### 7.1. Agregar una variante (US1, FR-001, FR-002, FR-003, FR-006)

```text
Client Component (drawer / detalle de producto)
      │  addCartItem({ variantId, quantity })
      ▼
features/cart/actions/cart-actions.ts        (Server Action)
      │  1. Zod: variantId uuid + quantity int 1..99            → FR-005
      │  2. Resolver identidad server-side:
      │       a. getUser() (sesión Supabase) → { kind:'user' }
      │       b. cookie morchi_cart_token    → { kind:'session' }
      │       c. ninguna → ensureCartSession() genera uuid httpOnly → { kind:'session' }
      ▼
features/cart/services/cart-service.ts       (dominio, cliente admin)
      │  3. Obtener/crear carrito activo de la identidad            → FR-001
      │  4. Validar comprabilidad server-side:
      │       variante is_active AND producto status='active' AND deleted_at IS NULL → FR-006
      │  5. Verificar disponibilidad (quantity - reserved_quantity >= qty) informativa → FR-006
      │  6. Upsert de cart_items (cart_id, variant_id):
      │       existente → quantity += qty ; nueva → insert      → FR-003, SC-001
      ▼
      │  7. revalidatePath(rutas afectadas) y devolver CartView
```

### 7.2. Modificar o eliminar (US2, FR-004, FR-005, SC-002)

```text
Client Component → updateCartItem({ itemId, quantity }) | removeCartItem({ itemId })
      ▼
Server Action: Zod (quantity >= 1) → resolver identidad → servicio
      ▼
cart-service:
  1. Cargar el carrito activo de la identidad
  2. Verificar ownership de la línea (cart_id pertenece a la identidad) → CART_ITEM_NOT_FOUND
  3. update quantity | delete línea
  4. Recalcular el carrito desde sus líneas actuales            → SC-002
      ▼
revalidatePath → CartView actualizado
```

### 7.3. Checkout (US1/US2, FR-007, FR-009, SC-003, SC-004)

```text
app/(store)/checkout/page.tsx  (Server Component)
      │  getCart(identity) → si no hay carrito activo o sin líneas: estado vacío
      │  render del resumen + formulario de email (precio informativo)
      ▼
checkoutCart({ email, idempotencyKey })      (features/checkout/services/checkout-cart.ts)
      │  1. Resolver identidad server-side y cargar líneas activas del carrito
      │  2. Delegar en create_checkout_order (RPC, módulo 004):
      │       - revalidar variante activa / producto activo / stock suficiente → FR-007, SC-004
      │       - congelar precio, nombre, SKU y total en order_items (snapshot)
      │       - reservar inventario (006) de forma atómica
      │       - marcar carts.status = 'converted'                          → FR-009, SC-003
      │  3. Generar preferencia de pago (005) y devolver resultado
      ▼
Redirección al flujo de pago / confirmación
```

Cualquier fallo de dominio dentro de la transacción de checkout revierte el pedido y no deja el
carrito a medio convertir. Un segundo intento con la misma `idempotencyKey` no duplica el pedido.

---

## 8. Fases de implementación

### Fase 0 — Setup

- Verificar/incorporar Vitest y Playwright con scripts en `package.json`, y `typecheck`/`lint`.
- Confirmar `lib/supabase/server.ts`, `lib/supabase/admin.ts` y las variables de entorno en
  `.env.example` y `lib/env.ts` (constitución §IV).
- Regenerar `types/database.types.ts` a partir del esquema que incluye `carts`/`cart_items`.

### Fase 1 — Migración, constraints y RLS

- Validar `supabase/migrations/20260920000007_cart.sql`: `carts` con `session_token` y
  `carts_owner_present`, `cart_items` con `unique(cart_id, variant_id)` y `check (quantity > 0)`.
- Verificar índices únicos parciales de carrito activo por `user_id` y `session_token`.
- Verificar políticas RLS de `carts`/`cart_items` para `authenticated` y ausencia de grants/policies
  para `anon`; `service_role` con bypass.
- Test SQL de RLS en `supabase/tests/cart_rls.test.sql`.

### Fase 2 — Dominio y contrato

- `features/cart/types/cart.types.ts` con tipos, inputs y errores.
- `features/cart/schemas/cart.schema.ts` con Zod (uuid de variante, cantidad entera `1..99`).
- `features/cart/services/cart-service.ts`: `getCart`, `addCartItem`, `updateCartItem`,
  `removeCartItem`, con validación de comprabilidad (FR-006) y upsert (FR-003).

### Fase 3 — Server Actions e identidad

- `features/cart/actions/cart-actions.ts`: `ensureCartSession` (cookie `morchi_cart_token`),
  `addCartItem`, `updateCartItem`, `removeCartItem`.
- Resolución de identidad server-side y revalidación selectiva tras cada mutación.

### Fase 4 — UI

- `components/store/cart-drawer.tsx` (Client Component): lista líneas, cambia cantidades, elimina,
  enlaza a `/checkout`; accesible por teclado, con estados de carga/error.
- `app/(store)/checkout/page.tsx` (Server Component): resumen del carrito y formulario de email.

### Fase 5 — Integración con checkout

- `features/checkout/services/checkout-cart.ts`: `checkoutCart` (carga el carrito activo server-side y
  delega en la RPC `create_checkout_order`).
- Verificar la conversión `carts.status = 'converted'` dentro de la transacción de checkout y la
  idempotencia por `orders.idempotency_key` (módulo 004).

### Fase 6 — Tests

- Unit (Vitest): schemas, resolución de identidad, mapeo y coherencia de subtotal informativo.
- Integración/RLS: servicio de carrito, carrito anónimo por `session_token`, aislamiento entre
  usuarios y denegación a `anon`.
- E2E (Playwright): agregar variante, modificar/eliminar y drawer → `/checkout`.

### Fase 7 — Verificación y cierre

- `lint`, `typecheck`, `test`, `build` (según scripts reales del repo).
- Validación de la migración desde base limpia y de RLS permitida/denegada.
- Revisión de accesibilidad y de que no haya secretos ni cambios fuera de alcance.

---

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Dos carritos activos para la misma identidad | Líneas divididas / SC-001 | Índices únicos parciales por `user_id` y `session_token`; el servicio recupera/crea el activo de forma idempotente. |
| Líneas duplicadas de la misma variante | FR-003 / SC-001 | `unique(cart_id, variant_id)` + upsert de cantidad. |
| Agregar variante no comprable o sin stock | FR-006 | Validación server-side al agregar; la autoridad final la revalida la RPC de checkout (FR-007). |
| Precio/stock enviado por el navegador | Cobro incorrecto | El carrito muestra precio informativo; el precio definitivo se congela en la RPC (assumption de spec). |
| Acceso a carrito de otro usuario | Seguridad | Identidad derivada server-side; RLS + verificación de ownership de la línea; `service_role` solo tras resolver identidad. |
| Cookie de sesión anónima accesible desde JS | Seguridad | `httpOnly`, `sameSite: 'lax'`, `secure` en producción; emitida en Server Action. |
| `SUPABASE_SECRET_KEY` filtrada al cliente | Compromiso total | `server-only` en `lib/supabase/admin.ts`; ninguna operación de carrito desde el navegador. |
| Reconversión del mismo carrito | Doble pedido / SC-003 | `carts.status = 'converted'` al crear el pedido; idempotencia por `orders.idempotency_key`. |
| Migración no reproducible | Fallo de despliegue | Migración versionada; `supabase db reset`/`supabase test db`. |
| Ausencia de runner de tests | Sin red de seguridad | Vitest/Playwright como tareas bloqueantes de release (Fase 6). |
| Rendimiento del drawer | UX | Client Component acotado; lecturas en servidor; sin cache compartida del carrito. |

---

## 10. Out of scope

- **Fusión del carrito anónimo con el carrito del usuario al iniciar sesión.** La identidad
  autenticada y la de sesión anónima se tratan por separado; el merge se resolverá en una iteración
  posterior con su especificación.
- **Direcciones y datos de envío:** pertenecen a `002-customers`/`008-shipping`. La página `/checkout`
  de este módulo solo captura el email.
- **Creación del pedido, cálculo autoritativo de totales y snapshots:** `004-checkout-orders`
  (la RPC `create_checkout_order` es su contrato).
- **Pagos y webhooks:** `005-payments`.
- **Reserva/descuento efectivo de stock y movimientos de inventario:** `006-inventory`.
- **Promociones/cupones:** `009-promotions`.
- **Diseños y personalización de líneas:** `007-designs`.
- **API REST pública del carrito:** no se exponen Route Handlers; las mutaciones internas usan Server
  Actions (`ARCHITECTURE.md` §14).
- Recuperación de carritos `abandoned`, marketing de abandono y múltiples carritos por usuario.