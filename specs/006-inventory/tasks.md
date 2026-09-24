# Tasks: Inventario, reservas y movimientos

Feature Branch: `006-inventory`

Plan: [plan.md](./plan.md) · Spec: [spec.md](./spec.md)

Referencias de gobierno: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) (v1.0.0, §V Test-Backed Quality, §VI Idempotencia), [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §11.2, §17, §18.

Convenciones:
- `[P]` = tarea paralelizable con otras de la misma fase.
- Rutas root-based con alias `@/`, sin `src/`.
- Toda escritura de stock pasa por funciones PostgreSQL; nunca por mutación directa desde el cliente (FR-010).

---

## Fase 0 — Preparación

- [ ] T001 Configurar Vitest para unit e integración en `package.json`, `vitest.config.ts` y entorno Postgres aislado para tests de DB.
- [ ] T002 [P] Configurar Playwright y script e2e en `package.json` / `playwright.config.ts` para el journey crítico de checkout con stock.
- [ ] T003 [P] Agregar scripts `test`, `test:unit`, `test:integration`, `typecheck` en `package.json`.
- [ ] T004 Generar/actualizar `types/database.types.ts` con `inventory_levels`, `inventory_movements` y `variant_availability`.
- [ ] T005 Documentar en `README.md` el procedimiento para aplicar migraciones desde una base limpia y correr tests de inventario.

---

## Fase 1 — Esquema de base de datos (FR-001, FR-002, FR-006, FR-007, FR-008)

- [ ] T006 Crear `supabase/migrations/20260920000100_inventory_schema.sql` con la tabla `public.inventory_levels` (`variant_id` único, FK a `product_variants`, `quantity`, `reserved_quantity`, `updated_at`).
- [ ] T007 [P] En la misma migración, agregar constraints `quantity >= 0`, `reserved_quantity >= 0` y `reserved_quantity <= quantity` (SC-001, SC-002).
- [ ] T008 [P] En la misma migración, crear `public.inventory_movements` con `quantity <> 0`, `movement_type` restringido a (`purchase`, `sale`, `reservation`, `release`, `adjustment`, `return`), `reference_id`, `note`, `created_at` (FR-006, FR-008).
- [ ] T009 [P] Crear índice de historial `(variant_id, created_at desc)` en `inventory_movements` (FR-007).
- [ ] T010 [P] Crear índice único parcial `inventory_movements_idempotency_idx` sobre `(variant_id, movement_type, reference_id)` para `reservation`, `sale`, `release` con `reference_id` no nulo (FR-009, SC-004).
- [ ] T011 Verificar que la migración aplica desde una base limpia y que los constraints rechazan valores negativos.

---

## Fase 2 — RLS y disponibilidad (FR-003, FR-010)

- [ ] T012 Crear `supabase/migrations/20260920000110_inventory_rls.sql` habilitando RLS en `inventory_levels` e `inventory_movements`.
- [ ] T013 En la misma migración, crear política `SELECT` para `anon` y `authenticated` en `inventory_levels` (lectura de disponibilidad); sin políticas de `INSERT`/`UPDATE`/`DELETE` (FR-010).
- [ ] T014 [P] En la misma migración, dejar `inventory_movements` sin políticas para `anon`/`authenticated` (solo `service_role`/backend) (US3, FR-010).
- [ ] T015 [P] Crear la vista `public.variant_availability` con `available = quantity - reserved_quantity` y `security_invoker = true` (FR-003).
- [ ] T016 Otorgar `SELECT` sobre `variant_availability` a `anon` y `authenticated`; no otorgar escritura sobre tablas base.
- [ ] T017 Verificar que un cliente anónimo/autenticado puede leer disponibilidad pero no modificar `inventory_levels` ni `inventory_movements`.

---

## Fase 3 — Funciones atómicas e idempotentes (FR-004, FR-005, FR-009; ARCHITECTURE.md §17, §18)

- [ ] T018 Crear `supabase/migrations/20260920000120_inventory_functions.sql` con `public.reserve_inventory(p_variant_id uuid, p_quantity integer, p_reference_id uuid) returns public.inventory_levels`, `security definer`, `set search_path = ''`.
- [ ] T019 En `reserve_inventory`, bloquear la fila con `SELECT ... FOR UPDATE`, validar `quantity - reserved_quantity >= p_quantity` y lanzar excepción si no alcanza (FR-005).
- [ ] T020 En `reserve_inventory`, incrementar `reserved_quantity`, actualizar `updated_at` e insertar movimiento `reservation` negativo con `reference_id` (FR-006, FR-008).
- [ ] T021 Crear `public.create_checkout_order(p_payload jsonb) returns uuid` que crea el pedido y reserva todas las líneas en una sola transacción llamando a `reserve_inventory`, con bloqueo en orden determinista por `variant_id` (FR-004; límite 004-checkout-orders).
- [ ] T022 Crear `public.confirm_order_inventory(p_order_id uuid) returns void`: por cada línea decrementa `quantity` y `reserved_quantity` e inserta movimiento `sale` con `reference_id = p_order_id` (FR-006).
- [ ] T023 En `confirm_order_inventory`, hacer no-op si ya existe un `sale` para la referencia y usar `on conflict do nothing` sobre el índice de idempotencia (FR-009, SC-004).
- [ ] T024 Crear `public.release_order_inventory(p_order_id uuid) returns void`: decrementa `reserved_quantity` e inserta movimiento `release` con `reference_id = p_order_id` (FR-004, FR-006).
- [ ] T025 En `release_order_inventory`, hacer no-op si ya existe `release` o `sale` para la referencia; no liberar reservas inexistentes (FR-009, SC-004).
- [ ] T026 Revocar `EXECUTE` de `public`, `anon` y `authenticated` y otorgar solo a `service_role` para las cuatro funciones (FR-010).
- [ ] T027 Verificar `set search_path = ''` y nombres totalmente calificados en todas las funciones (seguridad).

---

## Fase 4 — Capa TypeScript server-side (FR-003, FR-004)

- [ ] T028 Crear `features/inventory/types/inventory.types.ts` con `MovementType`, `InventoryLevel`, `VariantAvailability` y tipos de entrada/salida de RPC.
- [ ] T029 [P] Crear `features/inventory/queries/get-variant-availability.ts` usando `lib/supabase/server.ts` sobre la vista `variant_availability`.
- [ ] T030 [P] Crear `features/inventory/queries/get-variants-availability.ts` para lotes de `variant_id`.
- [ ] T031 [P] Crear `features/inventory/services/reserve-inventory.ts` que invoca la RPC `reserve_inventory` con `createAdminClient()` (`@/lib/supabase/admin`).
- [ ] T032 [P] Crear `features/inventory/services/create-checkout-order.ts` que invoca `create_checkout_order`.
- [ ] T033 [P] Crear `features/inventory/services/confirm-order-inventory.ts` que invoca `confirm_order_inventory`.
- [ ] T034 [P] Crear `features/inventory/services/release-order-inventory.ts` que invoca `release_order_inventory`.
- [ ] T035 Traducir errores de disponibilidad insuficiente a un error de dominio estable sin filtrar detalles internos ni secretos.
- [ ] T036 Verificar que ningún `service` se importa desde Client Components (`server-only`).

---

## Fase 5 — Integración con checkout y pagos (dependencias 004, 005)

- [ ] T037 Invocar `createCheckoutOrder` desde el flujo server-side de checkout (`004-checkout-orders`) para reservar stock dentro de la transacción del pedido.
- [ ] T038 Invocar `confirmOrderInventory` desde la reconciliación de pago aprobado (`005-payments`) de forma idempotente ante webhooks duplicados.
- [ ] T039 Invocar `releaseOrderInventory` desde cancelación de checkout y pago rechazado.
- [ ] T040 Verificar que un fallo de reserva revierte la creación del pedido y no deja movimientos huérfanos.

---

## Fase 6 — Tests (constitución §V)

- [ ] T041 [P] Unit: `tests/unit/inventory/availability.test.ts` — `available = quantity - reserved_quantity`, incluido `available = 0` (FR-003, SC-001).
- [ ] T042 [P] Integración: `tests/integration/inventory/reserve.integration.test.ts` — reserva feliz y reserva rechazada por disponibilidad insuficiente (FR-004, FR-005).
- [ ] T043 [P] Integración: disponibilidad negativa — una secuencia de reservas no puede dejar `available < 0` ni violar los constraints (SC-002).
- [ ] T044 [P] Concurrencia: `tests/integration/inventory/concurrency.integration.test.ts` — dos reservas simultáneas sobre la última unidad: solo una tiene éxito (SC-001, SC-002).
- [ ] T045 [P] Idempotencia de reserva: ejecutar `reserve_inventory` dos veces con la misma referencia no duplica el movimiento `reservation` ni la reserva (FR-009, SC-004).
- [ ] T046 [P] Idempotencia de liberación: doble `release_order_inventory` no suma unidades dos veces y deja un único movimiento `release` (FR-009, SC-004).
- [ ] T047 [P] Idempotencia de venta: doble `confirm_order_inventory` descuenta stock una sola vez y deja un único movimiento `sale` (FR-009, SC-004).
- [ ] T048 [P] Liberar una reserva inexistente no altera stock ni crea movimientos (edge case de la spec).
- [ ] T049 [P] RLS: `tests/integration/inventory/rls.integration.test.ts` — `anon`/`authenticated` no pueden `INSERT`/`UPDATE`/`DELETE` inventario ni ejecutar las funciones de escritura; `service_role` sí (FR-010).
- [ ] T050 [P] Auditoría: una venta, una devolución y un ajuste generan movimientos con tipo, cantidad y referencia correctos (FR-006, FR-007, FR-008; SC-003).
- [ ] T051 E2E: journey crítico de checkout donde la última unidad se agota durante el flujo y el segundo comprador es rechazado.

---

## Fase 7 — Observabilidad y cierre

- [ ] T052 Agregar logs estructurados con `correlation_id`, `variant_id`/`order_id` y códigos de operación (`inventory.reserve`, `inventory.confirm`, `inventory.release`) sin datos sensibles (constitución §VII).
- [ ] T053 Verificar que las migraciones son reproducibles desde base limpia y que RLS/grants quedan aplicados.
- [ ] T054 Ejecutar `lint`, `typecheck`, `test` y `build`, y documentar cualquier excepción.
- [ ] T055 Actualizar `types/database.types.ts` y documentación del módulo si cambió algún contrato.

---

## Trazabilidad

| Requisito | Tareas |
|---|---|
| FR-001 | T006, T011 |
| FR-002 | T006, T007 |
| FR-003 | T015, T029, T030, T041 |
| FR-004 | T018, T021, T024, T031–T034, T042 |
| FR-005 | T019, T042, T043, T044 |
| FR-006 | T008, T020, T022, T024, T050 |
| FR-007 | T009, T050 |
| FR-008 | T008, T020, T050 |
| FR-009 | T010, T023, T025, T045–T048 |
| FR-010 | T012–T014, T026, T049 |
| SC-001 | T007, T041, T044 |
| SC-002 | T007, T043, T044 |
| SC-003 | T050 |
| SC-004 | T010, T023, T025, T045–T047 |
