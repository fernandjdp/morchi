# Plan Técnico: Pagos y conciliación

Feature Branch: `005-payments`

Feature Spec: [`spec.md`](./spec.md)

Referencias de gobierno: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) (v1.0.0) y [`ARCHITECTURE.md`](../../ARCHITECTURE.md) (§5, §7.3, §7.4, §11, §14, §15, §17, §18, §19, §20, §21, §22, §23).

Status: Draft

---

## 1. Summary

Este plan implementa el módulo **005-payments**: integración de pagos con **Mercado Pago** para pedidos creados por **004-checkout-orders**, con preferencias de pago, identificadores externos, webhooks de reconciliación, idempotencia y registro de reembolsos/cancelaciones.

El objetivo es que el estado financiero del pedido se determine **a partir de estado verificado del proveedor** (server-to-server), y nunca a partir del redirect del navegador (FR-009, ARCHITECTURE.md §5 y §28).

Decisiones ya fijadas que este plan refleja:

- El dominio depende de una interfaz `PaymentProvider`; Mercado Pago es una adaptación en `features/payments/mercadopago` (ARCHITECTURE.md §15).
- El webhook vive en un Route Handler delgado: `app/api/webhooks/mercadopago/route.ts` (ARCHITECTURE.md §6 y §14).
- La conciliación es idempotente: unicidad sobre `(provider, provider_payment_id)` y transiciones de estado controladas (constitución §VI, ARCHITECTURE.md §18).
- La aprobación de pago confirma inventario vía RPC transaccional `confirm_order_inventory(order_id)`; el rechazo/cancelación libera vía `release_order_inventory(order_id)` (constitución §III, ARCHITECTURE.md §11.2 y §17).
- Los secretos viven solo en el servidor mediante `lib/env.ts` (constitución §IV, ARCHITECTURE.md §23).

---

## 2. Technical Context

| Aspecto | Decisión |
|---|---|
| Framework | Next.js App Router (root-based, **sin** `src/`), alias `@/*` → `./*` |
| Lenguaje | TypeScript estricto |
| Validación | Zod (`features/payments/schemas`) |
| Acceso a datos | Supabase PostgreSQL vía `@supabase/supabase-js`; cliente admin server-only en `lib/supabase/admin.ts` |
| Mutaciones privilegiadas | Cliente con `SUPABASE_SECRET_KEY` (bypass RLS) solo desde servidor |
| Lecturas de usuario | Cliente SSR con sesión y RLS (`lib/supabase/server.ts`) |
| Integración de pagos | Adaptador Mercado Pago detrás de la interfaz `PaymentProvider` |
| Endpoint entrante | Route Handler `POST /api/webhooks/mercadopago` |
| Migraciones | SQL versionado en `supabase/migrations/` |
| Testing | Vitest (unitario/integración) + Playwright (E2E), con dobles deterministas; nunca se llama a Mercado Pago real (constitución §V) |
| Observabilidad | Logs estructurados con `correlation id` y códigos de operación/error, sin secretos (constitución §VII, ARCHITECTURE.md §20) |
| Entorno | local / preview / production con credenciales separadas (ARCHITECTURE.md §24) |

### Variables de entorno

Client-safe (bundle permitido):

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Server-only (nunca al navegador, nunca a logs, nunca a tablas):

```text
SUPABASE_SECRET_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
```

Ya centralizadas en `lib/env.ts` mediante `getMercadoPagoEnv()`, `getServerSupabaseEnv()` y `getSiteUrl()`. Este plan **no** introduce nuevas variables.

---

## 3. Constitution Check

Evaluación de los principios I–VII de la constitución v1.0.0. Ningún principio se declara violado; no se requiere Complexity Tracking.

| Principio | Estado | Cómo lo cumple este plan |
|---|---|---|
| I. Spec-Driven Modular Architecture | PASS | El plan deriva de `spec.md` (FR-001..FR-010, SC-001..SC-004) y referencia `ARCHITECTURE.md` §15 sin duplicar decisiones globales. La integración queda encapsulada en `features/payments` y no contamina `orders`/`checkout` con tipos del proveedor. |
| II. Next.js Server-First Application | PASS | Toda la lógica de dominio vive en `features/payments/services`; el webhook es un Route Handler delgado que delega. No hay reglas de negocio en Client Components. |
| III. Supabase Data Integrity & Security | PASS | Cambios de esquema vía migración versionada; constraints (`unique(provider, provider_payment_id)`, `amount >= 0`, estados enumerados, FK a `orders`); RLS con lectura limitada a pagos propios y mutaciones por `service_role`; confirmación/release de inventario en RPC transaccional. |
| IV. Secure Boundaries & Secrets | PASS | Webhook valida firma HMAC (`MERCADOPAGO_WEBHOOK_SECRET`, headers `x-signature`/`x-request-id`) antes de cualquier cambio de estado; `MERCADOPAGO_ACCESS_TOKEN` y `SUPABASE_SECRET_KEY` son server-only; nunca se persisten credenciales en tablas expuestas; no se loguean secretos ni datos sensibles de pago. |
| V. Test-Backed Quality | PASS | Unit tests de mapeo de estados y validación de firma; integration tests de webhook (duplicado/idempotencia, firma inválida, importe/moneda incompatible) y de RLS; E2E del journey de pago. Proveedor reemplazado por dobles deterministas. |
| VI. Idempotent Commerce & Integration Workflows | PASS | Unicidad `(provider, provider_payment_id)` + transiciones de estado permitidas evitan doble efecto; preferencia reutilizada para el mismo pedido; confirmar/release inventario idempotentes; la aprobación se determina por estado verificado del proveedor, no por redirect. |
| VII. Observable, Performant, Accessible Delivery | PASS | Logs estructurados por operación con `request_id`/`order_id`/`payment_id`/`provider_payment_id` y códigos estables; lectura de pagos propios renderizada en servidor; el flujo de pago externo no expone datos de tarjeta a la aplicación. |

Foco explícito en los dos principios críticos para esta feature:

- **§IV (webhooks seguros):** el orden es *validar firma → validar payload → resolver recurso local → operar de forma idempotente → registrar → responder*. Una firma ausente o inválida produce `401`/`400` **sin** tocar `payments` ni `orders`.
- **§VI (idempotencia):** recibir dos veces la misma notificación debe dejar el mismo estado final (SC-002). La unicidad de `provider_payment_id` y una tabla de transiciones válidas convierten reintentos en no-ops.

---

## 4. Project Structure

Estructura objetivo (root-based, sin `src/`). Solo se listan rutas relevantes a esta feature.

```text
app/
└── api/
    └── webhooks/
        └── mercadopago/
            └── route.ts                     # Route Handler delgado (POST)

features/
├── checkout/
│   └── services/
│       └── start-payment.ts                 # orquesta creación de preferencia (server)
└── payments/
    ├── mercadopago/
    │   ├── client.ts                        # inicializa SDK con access token server-only
    │   ├── provider.ts                      # implementa PaymentProvider
    │   ├── signature.ts                     # verificación de x-signature (HMAC)
    │   └── map-status.ts                    # mapeo estado MP → estado local
    ├── services/
    │   ├── create-preference.ts             # caso de uso: crear/reutilizar preferencia
    │   ├── process-notification.ts          # caso de uso: reconciliar webhook
    │   └── record-refund.ts                 # caso de uso: registrar reembolso/cancelación
    ├── schemas/
    │   └── notification.schema.ts           # Zod: payload del webhook
    └── types/
        ├── payment.types.ts                 # Payment, estados, refs externas
        └── provider.types.ts                # PaymentProvider + inputs/outputs

lib/
├── env.ts                                   # (existente) acceso a secretos
├── supabase/
│   ├── admin.ts                             # (existente) cliente service_role
│   └── server.ts                            # (existente) cliente SSR/RLS
└── observability/
    └── logger.ts                            # logs estructurados sin secretos

supabase/
├── migrations/
│   ├── 0005_payments.sql                    # tabla payments + constraints + índices
│   └── 0005_payments_rls.sql                # grants + RLS + RPC de inventario (si aplica)
└── tests/
    └── payments_rls.test.sql                # pruebas de políticas

tests/
├── unit/
│   └── payments/
│       ├── map-status.test.ts
│       └── signature.test.ts
├── integration/
│   └── payments/
│       ├── webhook-idempotency.test.ts
│       ├── webhook-invalid-signature.test.ts
│       └── webhook-amount-currency.test.ts
└── e2e/
    └── payment-journey.spec.ts
```

Reglas de dependencia (ARCHITECTURE.md §16):

```text
Route Handler / Server Function
      ↓
features/payments/services  (casos de uso)
      ↓
features/payments/types     (interfaz PaymentProvider)
      ↓
features/payments/mercadopago (adaptador)  +  lib/supabase/admin.ts
```

Ningún componente React importa el SDK de Mercado Pago ni la secret key de Supabase.

---

## 5. Data Model

Fuente: `specs/base.md` §14, ajustada a los requisitos de la spec.

### 5.1. `payments`

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references orders(id) on delete cascade,

  provider text not null
    check (provider in ('mercadopago', 'cash', 'bank_transfer', 'other')),

  provider_payment_id text,        -- identificador externo del pago (FR-002)
  provider_preference_id text,     -- preferencia/sesión externa (FR-003)
  provider_status text,            -- estado crudo del proveedor (FR-006/FR-008)

  status text not null
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),

  amount numeric(12,2) not null
    check (amount >= 0),           -- importe observado (FR-007)

  currency text not null default 'ARS',   -- moneda observada (FR-007)

  raw_response jsonb,              -- metadata cruda para troubleshooting (FR-008)

  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Invariantes y constraints:

- `unique (provider, provider_payment_id)` — bloquea duplicados del mismo pago externo (FR-004, SC-002). Debe ser parcial/condicionado a `provider_payment_id is not null`.
- `unique (provider, provider_preference_id)` cuando `provider_preference_id is not null` — permite recuperar la preferencia del mismo pedido sin crear otra contradictoria (FR-003, US1 escenario 2).
- Índice `(order_id, status)` para resolver el pago local desde el webhook y listar pagos propios.
- FK a `orders`; el estado financiero del pedido vive en `orders.payment_status` y **no** se colapsa con `payments.status` (FR-006).

`raw_response` **no** debe contener secretos ni datos completos de tarjeta (constitución §IV y Security & Data Governance); se guarda solo metadata de troubleshooting (FR-008).

### 5.2. `orders.payment_status`

Ya existe en `specs/base.md` §11 con estados `pending | approved | rejected | refunded | cancelled`. Este módulo es quien lo actualiza como consecuencia de la reconciliación, respetando transiciones válidas.

### 5.3. RPC de inventario (frontera con 006-inventory)

Funciones transaccionales invocadas con `service_role`:

```text
confirm_order_inventory(order_id uuid)   -- al aprobarse el pago
release_order_inventory(order_id uuid)   -- al rechazarse o cancelarse
```

Ambas deben ser idempotentes: repetir la llamada no duplica movimientos ni descuenta stock dos veces (constitución §VI, 006-inventory FR-009/SC-004). La implementación detallada corresponde al plan de 006-inventory; aquí solo se define el contrato de invocación.

### 5.4. RLS

- `payments` tiene RLS habilitado.
- `SELECT`: el usuario autenticado solo puede leer los pagos de **sus propios** pedidos (`payments.order_id` → `orders.user_id = auth.uid()`).
- `INSERT`/`UPDATE`/`DELETE`: sin políticas para `anon`/`authenticated`; las mutaciones ocurren exclusivamente con `service_role` (webhook y casos de uso server-only).
- Se verifican grants **y** policies, y se prueban casos permitidos y denegados (ARCHITECTURE.md §9, §22).

---

## 6. Contracts

### 6.1. Interfaz `PaymentProvider` (dominio)

Definida en `features/payments/types/provider.types.ts`. El dominio depende de esta interfaz; Mercado Pago la implementa (ARCHITECTURE.md §15).

```ts
export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'

export interface CreatePreferenceInput {
  orderId: string
  amount: number
  currency: string
  description: string
  payerEmail?: string
  items: Array<{ title: string; quantity: number; unitPrice: number }>
  backUrls: { success: string; failure: string; pending: string }
  notificationUrl: string
  idempotencyKey: string
}

export interface CreatePreferenceResult {
  preferenceId: string
  initPoint: string
}

export interface PaymentResult {
  providerPaymentId: string
  status: PaymentStatus
  providerStatus: string
  amount: number
  currency: string
  paidAt: string | null
  raw: unknown
}

export interface PaymentProvider {
  createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult>
  getPayment(paymentId: string): Promise<PaymentResult>
}
```

Reglas de contrato:

- El adaptador **nunca** expone el access token ni tipos propios del SDK hacia `orders`/`checkout`.
- `getPayment` es la fuente de verdad para reconciliar; el redirect del navegador no es autoritativo (FR-009).
- El adaptador mapea estados del proveedor a `PaymentStatus` (`map-status.ts`); el estado crudo se conserva en `providerStatus`/`raw_response`.

### 6.2. Endpoint `POST /api/webhooks/mercadopago`

Route Handler delgado en `app/api/webhooks/mercadopago/route.ts`.

**Entrada**

- Headers: `x-signature` (`ts=...;v1=...`), `x-request-id`, `content-type`.
- Body JSON de notificación de Mercado Pago.

**Responsabilidades del handler (delegando en el servicio)**

1. Leer headers y body.
2. Validar firma con `MERCADOPAGO_WEBHOOK_SECRET`; si falla → `401` sin efectos.
3. Validar el payload con Zod; si es inválido → `400` sin efectos.
4. Delegar en `process-notification.ts`.
5. Responder `200` en éxito o cuando la notificación ya fue procesada (idempotencia); `4xx` para entrada no confiable; `5xx` solo para fallos de infraestructura reintentables.

**Salidas**

| Situación | Status | Efecto |
|---|---|---|
| Firma válida, pago conciliado | `200` | `payments` + `orders.payment_status` actualizados |
| Notificación duplicada (ya procesada) | `200` | Sin cambio de estado (no-op) |
| Firma inválida/ausente | `401` | Sin efectos |
| Payload inválido | `400` | Sin efectos |
| Importe/moneda incompatibles | `200` | Pago marcado para revisión; **no** habilita fulfillment (SC-003) |
| Error de infraestructura | `5xx` | Sin efectos parciales (operación transaccional) |

El handler **no** contiene reglas de negocio: resuelve autenticidad y forma, y delega (constitución §II).

### 6.3. Formato de notificación de Mercado Pago

Notificación tipo webhook (JSON). Forma típica:

```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "action": "payment.updated",
  "date_created": "2026-09-20T12:00:00.000Z",
  "user_id": "123456",
  "data": { "id": "987654321" }
}
```

Mercado Pago también puede notificar por IPN con query params `?type=payment&data.id=...`.

Reglas de parsing:

- `data.id` (o `data.id` del query en IPN) es el `provider_payment_id` a resolver.
- `type` debe ser `payment` para que el módulo reconcilie; otros tipos se reconocen y se ignoran de forma segura (respondiendo `200`).
- La firma se valida sobre el manifest documentado por Mercado Pago (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), calculando HMAC-SHA256 con el secreto y comparando contra `v1` en tiempo constante.
- El payload se valida con Zod (`notification.schema.ts`) antes de usarse.

El detalle exacto del manifest se contrasta con la documentación vigente del proveedor durante la implementación; la decisión de validar firma antes de operar es obligatoria (constitución §IV).

### 6.4. Resolución del pago local

```text
provider_payment_id
      ↓ (getPayment, server-side)
PaymentResult verificado
      ↓
buscar payments por (provider='mercadopago', provider_payment_id)
      ↓ si no existe, resolver por provider_preference_id / order
      ↓
verificar amount y currency contra orders.total / orders.currency
      ↓
aplicar transición de estado permitida
```

Nunca se confía en `order_id`, `amount` o `status` enviados por el cliente/navegador.

---

## 7. Sequence / Flow

### 7.1. Inicio de pago (US1)

```text
Comprador confirma pedido (004-checkout-orders)
        ↓
Server Function / caso de uso: start-payment
        ↓
validar pedido pendiente y total server-side
        ↓
¿existe pago pending con provider_preference_id para el pedido?
   ├── sí → reutilizar preferencia (idempotente, US1 escenario 2)
   └── no → PaymentProvider.createPreference(...)
                ↓
        persistir payments (provider, provider_preference_id, amount, currency, status='pending')
                ↓
        devolver initPoint al navegador (nunca el access token)
```

### 7.2. Reconciliación por webhook (US2, SC-004)

```text
Mercado Pago
    ↓ POST /api/webhooks/mercadopago  (x-signature, x-request-id)
Route Handler
    ↓ validar firma (MERCADOPAGO_WEBHOOK_SECRET) → 401 si falla
    ↓ validar payload (Zod) → 400 si inválido
    ↓ delegar
process-notification
    ↓ provider.getPayment(provider_payment_id)   ← estado verificado
    ↓ resolver payments local
    ↓ ¿ya está en el estado destino? → no-op idempotente (200)
    ↓ verificar amount/currency vs orders (SC-003)
    │     └── incompatible → marcar para revisión, NO confirmar fulfillment
    ↓ transición permitida:
    │     ├── approved → payments.status='approved', paid_at, orders.payment_status='approved'
    │     │              + confirm_order_inventory(order_id)   (RPC transaccional)
    │     ├── rejected/cancelled → payments.status, orders.payment_status
    │     │              + release_order_inventory(order_id)
    │     └── refunded → payments.status='refunded', orders.payment_status='refunded'
    ↓ registrar log estructurado (request_id, order_id, payment_id, provider_payment_id)
    ↓ responder 200
```

La operación de reconciliación (actualizar `payments` + `orders` + invocar la RPC) debe ejecutarse en una **transacción** o función de base de datos para evitar estados parciales (constitución §III, ARCHITECTURE.md §17).

### 7.3. Reembolso / cancelación (US3, FR-010)

```text
Operador solicita reembolso/cancelación
        ↓
record-refund: resolver pago original (nunca se borra)
        ↓
registrar resultado del reembolso (status='refunded')
        ↓
orders.payment_status='refunded' y liberar/reponer inventario según corresponda
        ↓
repetir la operación → no-op idempotente
```

---

## 8. Fases

1. **Fase 0 — Contratos y tipos.** Definir `PaymentProvider`, tipos de pago y schemas Zod; mapeo de estados. Sin dependencia del SDK real.
2. **Fase 1 — Persistencia y seguridad.** Migración `payments` con constraints e índices; grants y RLS; pruebas RLS. RPC de inventario (`confirm_order_inventory`, `release_order_inventory`) como contrato con 006-inventory.
3. **Fase 2 — Adaptador Mercado Pago.** `client.ts`, `provider.ts`, `signature.ts`, `map-status.ts` usando `MERCADOPAGO_ACCESS_TOKEN` server-only.
4. **Fase 3 — Inicio de pago.** Caso de uso `create-preference` + integración con checkout; reutilización idempotente de preferencia (US1).
5. **Fase 4 — Webhook y reconciliación.** Route Handler delgado + `process-notification`; firma, validación, idempotencia, verificación de importe/moneda, transición transaccional y RPC de inventario (US2, FR-004/005/006/007, SC-002/003/004).
6. **Fase 5 — Reembolsos.** `record-refund` sin borrar el pago original (US3, FR-010).
7. **Fase 6 — Observabilidad y calidad.** Logs estructurados, manejo de errores por naturaleza, y batería de tests (unit/integration/E2E) exigida por la constitución §V.

---

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Firma de webhook mal implementada | Alto: eventos falsos | Verificación HMAC en tiempo constante, tests de firma inválida/ausente; validar contra doc vigente del proveedor |
| Notificación duplicada o reintento | Alto: doble captura/stock | `unique(provider, provider_payment_id)`, transiciones idempotentes, no-op en estado ya alcanzado |
| Webhook llega antes que el navegador | Medio | Reconciliación server-to-server; el redirect nunca es autoritativo (FR-009) |
| Importe/moneda no coinciden | Alto: fraude/fulfillment indebido | Comparar `amount`/`currency` contra el pedido; marcar para revisión sin confirmar (SC-003) |
| Estado del proveedor no mapea a transición directa | Medio | `map-status` explícito + tabla de transiciones permitidas; estados no mapeables se registran sin forzar avance |
| Race entre webhook e inventario | Alto: sobreventa | RPC transaccional e idempotente `confirm_order_inventory`/`release_order_inventory` |
| Fuga de secretos | Crítico | `lib/env.ts` + `server-only`; nunca en tablas/logs/bundle; `.env.example` sin valores |
| Errores parciales en reconciliación | Alto | Transacción/función DB que agrupa `payments` + `orders` + inventario |
| Tests dependientes del proveedor real | Alto: flakiness/seguridad | Dobles deterministas; nunca llamar a Mercado Pago real (constitución §V) |

---

## 10. Out of Scope

- Administración de fulfillment, envíos o tracking (módulo 008-shipping).
- Cálculo de precios, descuentos, impuestos o totales del pedido (módulos 004/009).
- Lógica de reserva/stock (módulo 006-inventory); aquí solo se invocan las RPC acordadas.
- Múltiples pagos parciales por pedido (supuesto de `spec.md` v1).
- Almacenamiento de datos de tarjeta; el procesamiento permanece delegado a Mercado Pago.
- Multi-proveedor activo simultáneo y multi-moneda (solo se deja la interfaz y `currency` preparadas).
- Reembolsos parciales complejos, contracargos y conciliación contable avanzada.
- Panel administrativo completo de pagos más allá de la mínima lectura/registro requerido por la spec.
- Reintentos automáticos programados y reconciliación por polling fuera del webhook.
