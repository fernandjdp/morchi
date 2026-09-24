# Tareas: Pagos y conciliación

Feature Branch: `005-payments`

Feature Spec: [`spec.md`](./spec.md) · Plan: [`plan.md`](./plan.md)

Referencias de gobierno: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) (v1.0.0) y [`ARCHITECTURE.md`](../../ARCHITECTURE.md) (§14, §15, §17, §18, §20, §21, §22, §23).

Convenciones:

- `[P]` = tarea paralelizable con otras de la misma fase.
- Cada tarea referencia el requisito (`FR-xxx`) y/o criterio de éxito (`SC-xxx`) que satisface.
- Los tests de webhook (duplicado/idempotencia, firma inválida, importe/moneda incompatible) son obligatorios por constitución §V y se listan aunque aún no exista código.
- No se llama a Mercado Pago real en tests: se usan dobles deterministas (constitución §V).

---

## Fase 0 — Contratos, tipos y schemas

- [ ] **T001** Definir `PaymentStatus` y los tipos de dominio `Payment`, `PaymentProviderReference` y `PaymentNotification` en `features/payments/types/payment.types.ts` (FR-001, FR-002, FR-006).
- [ ] **T002** Definir la interfaz `PaymentProvider` con `createPreference(input)` y `getPayment(paymentId)`, junto con `CreatePreferenceInput/Result` y `PaymentResult`, en `features/payments/types/provider.types.ts` (ARCHITECTURE.md §15; FR-003).
- [ ] **T003** [P] Crear `features/payments/schemas/notification.schema.ts` con Zod para el payload de notificación de Mercado Pago (tipo, acción, `data.id`; soporte IPN por query params) (FR-005).
- [ ] **T004** [P] Implementar `features/payments/mercadopago/map-status.ts`: mapeo determinista de estados del proveedor → `PaymentStatus` y tabla de transiciones permitidas (FR-006).
- [ ] **T005** [P] Implementar `features/payments/mercadopago/signature.ts`: construcción del manifest y verificación HMAC-SHA256 en tiempo constante contra `MERCADOPAGO_WEBHOOK_SECRET` (constitución §IV; FR-005).
- [ ] **T006** [P] Unit tests en `tests/unit/payments/map-status.test.ts` para el mapeo de estados y transiciones permitidas/prohibidas (FR-006).
- [ ] **T007** [P] Unit tests en `tests/unit/payments/signature.test.ts`: firma válida, firma inválida, firma ausente y `ts` manipulado (constitución §IV/§V; FR-005).

---

## Fase 1 — Persistencia, constraints y RLS

- [ ] **T010** Crear migración versionada `supabase/migrations/0005_payments.sql` con la tabla `payments` (`order_id` FK a `orders`, `provider`, `provider_payment_id`, `provider_preference_id`, `provider_status`, `status`, `amount numeric(12,2)`, `currency`, `raw_response jsonb`, `paid_at`, timestamps) (FR-001, FR-002, FR-003, FR-007, FR-008; constitución §III).
- [ ] **T011** En la misma migración, agregar constraints: `amount >= 0`, estados enumerados en `status` y `provider`, `unique (provider, provider_payment_id)` (parcial a no nulos) y unicidad/índice de `provider_preference_id`, más índice `(order_id, status)` (FR-004; SC-002).
- [ ] **T012** Crear migración `supabase/migrations/0005_payments_rls.sql`: habilitar RLS en `payments`, `SELECT` limitado a pagos de pedidos propios (`auth.uid()`), sin políticas de escritura para `anon`/`authenticated` (mutaciones por `service_role`) (FR-008; ARCHITECTURE.md §9/§22).
- [ ] **T013** Definir/contratar las RPC transaccionales `confirm_order_inventory(order_id)` y `release_order_inventory(order_id)` como frontera con 006-inventory, ambas idempotentes (FR-004; SC-002; ARCHITECTURE.md §11.2/§17).
- [ ] **T014** [P] Tests de RLS en `supabase/tests/payments_rls.test.sql`: un usuario lee sus pagos y no los ajenos; `anon` no escribe (FR-008; constitución §V).
- [ ] **T015** [P] Test de migración desde base limpia y verificación de constraints/índices reproducibles (constitución §III; ARCHITECTURE.md §22).

---

## Fase 2 — Adaptador Mercado Pago

- [ ] **T020** Implementar `features/payments/mercadopago/client.ts` inicializando el SDK con `MERCADOPAGO_ACCESS_TOKEN` vía `getMercadoPagoEnv()`, marcado server-only (constitución §IV; ARCHITECTURE.md §23).
- [ ] **T021** Implementar `features/payments/mercadopago/provider.ts` como adaptación de `PaymentProvider`: `createPreference` y `getPayment`, sin filtrar tipos del SDK hacia el dominio (ARCHITECTURE.md §15; FR-003).
- [ ] **T022** Asegurar en `getPayment` que el estado devuelto provenga del proveedor y no del redirect/navegador (FR-009; ARCHITECTURE.md §5).
- [ ] **T023** [P] Test de adaptador con doble determinista del SDK: verifica mapeo de respuesta y que ningún secreto se serialice hacia el llamador (constitución §IV/§V).

---

## Fase 3 — Inicio de pago (US1)

- [ ] **T030** Implementar `features/payments/services/create-preference.ts`: validar pedido pendiente y total server-side, crear preferencia y persistir `payments` con `provider_preference_id`, `amount`, `currency`, `status='pending'` (FR-001, FR-003, FR-007).
- [ ] **T031** Implementar reutilización idempotente: si el pedido ya tiene un pago `pending` con `provider_preference_id`, recuperarlo en lugar de crear otro (US1 escenario 2; FR-003; SC-002).
- [ ] **T032** Integrar el inicio de pago con `features/checkout/services/start-payment.ts`, devolviendo `initPoint` al cliente sin exponer el access token (FR-009; constitución §IV).
- [ ] **T033** [P] Test de integración: dos solicitudes para el mismo pedido no generan preferencias/transacciones contradictorias (US1 escenario 2; SC-002).

---

## Fase 4 — Webhook y reconciliación (US2)

- [ ] **T040** Crear el Route Handler delgado `app/api/webhooks/mercadopago/route.ts`: leer headers (`x-signature`, `x-request-id`) y body, validar firma y payload, delegar en el servicio y mapear la respuesta HTTP (constitución §II; ARCHITECTURE.md §14).
- [ ] **T041** Garantizar que firma inválida/ausente responda `401` y payload inválido `400`, **sin** modificar `payments` ni `orders` (FR-005; constitución §IV).
- [ ] **T042** Implementar `features/payments/services/process-notification.ts`: resolver `provider_payment_id`, llamar `getPayment` para obtener estado verificado, y resolver el pago local (FR-002, FR-009).
- [ ] **T043** Implementar idempotencia en `process-notification`: no-op cuando el pago ya está en el estado destino; unicidad `(provider, provider_payment_id)` y transiciones permitidas (FR-004; SC-002).
- [ ] **T044** Verificar `amount` y `currency` observados contra `orders.total`/`orders.currency`; si son incompatibles, marcar para revisión y **no** habilitar fulfillment automáticamente (FR-007; SC-003).
- [ ] **T045** Aplicar transición transaccional: actualizar `payments` y `orders.payment_status`, y en aprobación invocar `confirm_order_inventory(order_id)`; en rechazo/cancelación invocar `release_order_inventory(order_id)` (FR-001, FR-004, FR-006; SC-004; constitución §III/§VI).
- [ ] **T046** Persistir metadata cruda del proveedor en `raw_response` sin secretos ni datos completos de tarjeta (FR-008; constitución §IV).
- [ ] **T047** Manejar tipos de notificación distintos de `payment` de forma segura (reconocer e ignorar con `200`) y distinguir errores de validación/autorización/dominio/infraestructura (ARCHITECTURE.md §20).
- [ ] **T048** [P] Test de integración `tests/integration/payments/webhook-idempotency.test.ts`: la misma notificación procesada dos veces deja el mismo estado final y un único efecto de negocio (FR-004; SC-002).
- [ ] **T049** [P] Test de integración `tests/integration/payments/webhook-invalid-signature.test.ts`: firma inválida/ausente → `401` sin cambios de estado (FR-005; constitución §IV).
- [ ] **T050** [P] Test de integración `tests/integration/payments/webhook-amount-currency.test.ts`: aprobación con importe o moneda incompatibles no marca el pedido como pagado ni habilita fulfillment (SC-003; FR-007).
- [ ] **T051** [P] Test de integración: notificación válida de aprobación cambia pago y pedido aunque el navegador no vuelva (US2 escenario 1; SC-004).

---

## Fase 5 — Reembolsos y cancelaciones (US3)

- [ ] **T060** Implementar `features/payments/services/record-refund.ts`: registrar reembolso/cancelación sobre el pago original **sin borrarlo** (FR-010).
- [ ] **T061** Actualizar `orders.payment_status` a `refunded`/`cancelled` según corresponda y coordinar la liberación/reposición de inventario (FR-006, FR-010; ARCHITECTURE.md §17).
- [ ] **T062** Hacer idempotente la repetición del reembolso: no duplicar estado ni efectos (US3 escenario 2; SC-002).
- [ ] **T063** [P] Test de integración: reembolso registrado mantiene referencia al pago externo original y su repetición es un no-op (US3; FR-010).

---

## Fase 6 — Observabilidad, calidad y verificación

- [ ] **T070** Emitir logs estructurados en webhook y casos de uso con `request_id`, `order_id`, `payment_id` y `provider_payment_id`, y códigos estables de operación/error, excluyendo secretos y datos sensibles (constitución §VII; ARCHITECTURE.md §20).
- [ ] **T071** Confirmar que ningún secreto (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`) se expone al bundle, a logs o a tablas; `lib/env.ts` es el único punto de acceso (constitución §IV; ARCHITECTURE.md §23).
- [ ] **T072** [P] E2E `tests/e2e/payment-journey.spec.ts`: checkout → inicio de pago → notificación aprobada → pedido refleja `payment_status=approved` (constitución §V; SC-004).
- [ ] **T073** [P] E2E de caso negativo: pago rechazado no confirma el pedido y libera la reserva (ARCHITECTURE.md §21).
- [ ] **T074** Verificar cobertura FR-001..FR-010 y SC-001..SC-004, y documentar cualquier excepción pendiente (constitución: Development Workflow & Quality Gates).
- [ ] **T075** Ejecutar los gates del repo (`pnpm lint`, `pnpm typecheck`, tests, `pnpm build`) o documentar explícitamente los no ejecutables (AGENTS.md §13).
