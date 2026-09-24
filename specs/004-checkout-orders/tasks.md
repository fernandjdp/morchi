# Tasks: Checkout y pedidos (`004-checkout-orders`)

Feature Branch: `004-checkout-orders`

Referencias de gobierno:
- `.specify/memory/constitution.md` v1.0.0 (principios I–VII), en especial §III (transacciones/RLS),
  §IV (secretos), §V (tests), §VI (idempotencia/snapshots).
- `ARCHITECTURE.md` (server-first, transacciones, snapshots, idempotencia, RLS).
- `specs/004-checkout-orders/spec.md` (FR-001..FR-010, SC-001..SC-004).
- Plan técnico: `specs/004-checkout-orders/plan.md`.
- Dependencias: 001 (catálogo), 002 (clientes/direcciones), 003 (carrito), 006 (inventario),
  009 (promociones).

Formato: `[ ]` pendiente, `[x]` completada. `[P]` indica tarea paralelizable dentro de su fase.
Cada tarea de tests es **bloqueante de release** (constitución §V): la feature no se considera
terminada con tests fallando o ausentes sin justificación documentada.

---

## Fase 0 — Preparación

- [ ] T001 Verificar que las migraciones base de 001/002/003/006 existen y pueden aplicarse sobre
  una base limpia; documentar orden de precedencia (001/002/003/006 → 004). Ref: constitución §III.
- [ ] T002 Confirmar que `types/database.types.ts` existe y regenerarlo tras cada migración.
- [ ] T003 Incorporar runner de tests (Vitest) y de E2E (Playwright) con scripts en `package.json`
  (`test`, `test:e2e`, `typecheck`, `lint`). Ref: constitución §V. *(Hoy el repo no los define.)*
- [ ] T004 Verificar que `lib/supabase/admin.ts` importa `server-only` y que `SUPABASE_SECRET_KEY`
  no tiene prefijo `NEXT_PUBLIC_`. Ref: constitución §IV.

---

## Fase 1 — Esquema, constraints y RLS

Ruta: `supabase/migrations/0004_orders.sql`

- [ ] T005 Crear tabla `orders` con `status`, `payment_status`, `fulfillment_status` separados,
  `currency`, totales `numeric(12,2)` no negativos, `email not null`, `user_id` anulable e
  `idempotency_key text unique`. Ref: FR-001, FR-004, FR-005, FR-007, FR-010.
- [ ] T006 Crear tabla `order_items` con snapshot `sku`, `product_name`, `variant_description`,
  `unit_price`, `quantity`, `line_total`; FKs a `orders` (cascade) y referencias best-effort a
  `products`/`product_variants` (`on delete set null`). Ref: FR-002, FR-009, SC-002.
- [ ] T007 Crear tabla `order_addresses` con `address_type in ('shipping','billing')` y
  `unique(order_id, address_type)`. Ref: FR-003.
- [ ] T008 Añadir constraints de coherencia: `quantity > 0`, `unit_price >= 0`, `line_total >= 0`,
  estados válidos por `check`, `total >= 0`. Ref: edge cases de la spec; FR-004.
- [ ] T009 Añadir índices de lectura: `orders(user_id, created_at desc)`, `order_items(order_id)`,
  `order_addresses(order_id)`. Ref: `ARCHITECTURE.md` §26.
- [ ] T010 Habilitar RLS en `orders`, `order_items`, `order_addresses`.
- [ ] T011 Crear policies de `SELECT` para `authenticated`: solo pedidos propios
  (`user_id = auth.uid()`) y sus líneas/direcciones asociadas. Ref: FR-008, SC-003.
- [ ] T012 Verificar que no existen policies de `INSERT`/`UPDATE`/`DELETE` para `anon` ni
  `authenticated` (mutaciones solo por `service_role`). Ref: constitución §III, `AGENTS.md` §11.
- [ ] T013 Validar la migración en base limpia (`supabase db reset` / `supabase test db`). Ref:
  `ARCHITECTURE.md` §22.

---

## Fase 2 — Función transaccional e idempotencia

Ruta: `supabase/migrations/0005_checkout_order_function.sql`

- [ ] T014 Implementar `create_checkout_order(p_idempotency_key, p_cart_id, p_email,
  p_shipping_address, p_billing_address, p_coupon_code, p_customer_note, p_user_id)` como
  `SECURITY DEFINER` con `search_path` controlado. Ref: plan §7; constitución §III.
- [ ] T015 Implementar detección de idempotencia: si ya existe `orders.idempotency_key`, devolver
  el pedido y líneas existentes sin re-reservar stock. Ref: FR-010, SC-004.
- [ ] T016 Bloquear filas de `inventory_levels` con `SELECT ... FOR UPDATE` y revalidar
  `available = quantity - reserved_quantity >= qty` para cada línea. Ref: FR-006, 006 §V.
- [ ] T017 Leer server-side `price`, `name`, `sku` y descripción de variante; descartar cualquier
  precio/stock proveniente del cliente. Ref: FR-002, FR-004; `ARCHITECTURE.md` §7.3.
- [ ] T018 Calcular `subtotal`, `discount_total` (vía 009), `shipping_total`, `tax_total` y `total`;
  rechazar `total < 0` o incoherente. Ref: FR-004; edge cases.
- [ ] T019 Insertar `orders` con los tres estados en sus valores iniciales y snapshot de totales.
  Ref: FR-001, FR-004, FR-005, FR-007.
- [ ] T020 Insertar `order_items` con el snapshot completo por línea. Ref: FR-002.
- [ ] T021 Insertar `order_addresses` de envío (y facturación si corresponde). Ref: FR-003.
- [ ] T022 Incrementar `reserved_quantity` e insertar `inventory_movements`
  (`movement_type='reservation'`, `reference_id = order.id`). Ref: 006 FR-004..FR-008.
- [ ] T023 Marcar el carrito como `converted` dentro de la misma transacción. Ref: 003 SC-003.
- [ ] T024 Asegurar rollback total ante cualquier error de dominio (sin pedido parcial ni stock
  reservado sin pedido). Ref: SC-001; constitución §III.
- [ ] T025 Restringir `EXECUTE` de la función a `service_role`. Ref: constitución §IV.

---

## Fase 3 — Dominio y acceso a datos

- [ ] T026 Crear `features/checkout/schemas/checkout.schema.ts` (Zod): request de checkout,
  `shippingAddress`, `billingAddress`, `idempotencyKey`, `couponCode`, `customerNote`; rechazar
  campos de importe enviados por el cliente. Ref: plan §6.1.
- [ ] T027 Crear `features/checkout/types/checkout.types.ts` y `features/checkout/types/order.types.ts`
  (`Order`, `OrderItem`, `OrderAddress`, contratos internos). Ref: FR-001..FR-005.
- [ ] T028 Crear `features/inventory/types/inventory.types.ts` (`InventoryLevel`,
  `InventoryMovement`, disponibilidad). Ref: 006 FR-002/FR-003.
- [ ] T029 Crear `features/inventory/services/inventory-service.ts`: traducir disponibilidad y el
  error de reserva de la RPC a errores de dominio (`INSUFFICIENT_STOCK`). Ref: FR-006.
- [ ] T030 Crear `features/checkout/services/checkout-service.ts`: resolver identidad, verificar
  ownership del carrito, consultar idempotencia y delegar el cálculo a la RPC con el cliente admin.
  Ref: FR-001, FR-006, FR-010; constitución §II.
- [ ] T031 Mantener el Route Handler delgado: la lógica de negocio no vive en `app/`. Ref:
  constitución §I/§II; `AGENTS.md` §9.

---

## Fase 4 — Endpoint HTTP

- [ ] T032 Crear `app/api/checkout/route.ts` (`POST`): parsear body, validar con Zod, resolver
  sesión, invocar `checkout-service` y mapear errores. Ref: plan §6.1.
- [ ] T033 Crear `lib/errors/checkout-error.ts` con el mapa código→status
  (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `CART_ALREADY_CONVERTED`, `ITEM_NOT_BUYABLE`,
  `INSUFFICIENT_STOCK`, `EMPTY_CART`, `COUPON_INVALID`, `INVALID_TOTAL`, `INTERNAL_ERROR`).
- [ ] T034 Responder `201` en creación y `200` con `idempotentReplay: true` en reintento con la
  misma `idempotencyKey`. Ref: FR-010, SC-004.
- [ ] T035 Devolver importes como string decimal y no exponer secretos ni datos internos en errores.
  Ref: constitución §IV, §VII; `AGENTS.md` §9.9.
- [ ] T036 Verificar autenticación/autorización dentro del handler (no confiar en la UI). Ref:
  constitución §II/§IV, `ARCHITECTURE.md` §8.

---

## Fase 5 — Lectura de pedidos

- [ ] T037 Crear `features/checkout/queries/get-order.ts` con el cliente de sesión (RLS). Ref:
  FR-008, SC-003.
- [ ] T038 Crear `features/checkout/queries/list-orders.ts` (historial propio, paginado). Ref:
  FR-008.
- [ ] T039 Confirmar que un cliente no puede leer pedidos ajenos por el flujo normal de lectura.
  Ref: SC-003.

---

## Fase 6 — Tests (bloqueantes, constitución §V)

### Unit

- [ ] T040 [P] Cálculo de subtotal, descuento, envío, impuestos y total; casos límite de total
  negativo/incoherente. Ref: FR-004; edge cases.
- [ ] T041 [P] Validación Zod del request de checkout (incluye rechazo de importes del cliente).
- [ ] T042 [P] Mapeo de errores de dominio a status HTTP y a códigos estables.

### Integración (contra base de test aislada)

- [ ] T043 **Idempotencia de checkout**: dos confirmaciones con la misma `idempotencyKey` producen
  **un solo** pedido y **una sola** reserva; la segunda responde replay. Ref: FR-010, SC-004;
  constitución §V/§VI.
- [ ] T044 **Stock insuficiente**: confirmar un pedido cuya cantidad supera la disponibilidad es
  rechazado con `INSUFFICIENT_STOCK`, sin crear pedido ni reservar stock. Ref: FR-006, SC-001.
- [ ] T045 **Concurrencia / no overselling**: dos checkouts simultáneos sobre la última unidad no
  reservan colectivamente más que el disponible. Ref: 006 FR-005/SC-002.
- [ ] T046 **Snapshots**: cambiar nombre/precio del producto tras el pedido no altera
  `order_items` ni el total histórico. Ref: FR-002, FR-009, SC-002.
- [ ] T047 **Snapshots de dirección**: editar/eliminar la dirección guardada no altera
  `order_addresses`. Ref: FR-003; 002 SC-004.
- [ ] T048 **Buyability**: variante inactiva/archivada es rechazada con `ITEM_NOT_BUYABLE` y sin
  pedido. Ref: FR-006.
- [ ] T049 **Carrito convertido**: reconvertir el mismo carrito es rechazado
  (`CART_ALREADY_CONVERTED`). Ref: 003 SC-003.
- [ ] T050 **RLS**: un usuario autenticado no puede leer `orders`/`order_items`/`order_addresses`
  de otro usuario. Ref: FR-008, SC-003; constitución §III.
- [ ] T051 **Rollback**: forzar un error de dominio a mitad de la transacción no deja pedido
  parcial ni movimiento de inventario. Ref: SC-001; constitución §III.

### E2E (Playwright)

- [ ] T052 Journey: carrito válido → checkout → confirmación con pedido y líneas correctas. Ref:
  SC-001, SC-002.
- [ ] T053 Caso negativo: item agotado en checkout se comunica y no crea pedido. Ref: FR-006.

---

## Fase 7 — Observabilidad, validación y cierre

- [ ] T054 Emitir logs estructurados con `request_id`/`order_id` y código de operación estable, sin
  secretos ni PII innecesaria. Ref: constitución §VII; `ARCHITECTURE.md` §20.
- [ ] T055 Ejecutar `lint`, `typecheck`, `test`, `build` (según scripts reales del repo) y resolver
  fallos. Ref: `AGENTS.md` §13.
- [ ] T056 Validar la migración desde base limpia y verificar políticas RLS permitidas/denegadas.
  Ref: `ARCHITECTURE.md` §21/§22.
- [ ] T057 Revisar que no haya secretos en archivos nuevos/modificados ni cambios fuera de alcance
  (`git status`/`git diff`). Ref: `AGENTS.md` §20/§22.
- [ ] T058 Revisión de convergencia contra `spec.md` (FR-001..FR-010, SC-001..SC-004) y Definition
  of Done (`AGENTS.md` §14); documentar cualquier hueco pendiente.

---

## Trazabilidad rápida

| Requisito | Tareas |
|---|---|
| FR-001 crear pedido | T005, T019, T030, T032 |
| FR-002 líneas históricas | T006, T017, T020, T046 |
| FR-003 dirección snapshot | T007, T021, T047 |
| FR-004 totales/moneda | T005, T008, T018, T019, T040 |
| FR-005 estados separados | T005, T019 |
| FR-006 impedir no comprable | T016, T029, T044, T048, T053 |
| FR-007 pedido de invitado | T005, T019, T036 |
| FR-008 historial propio | T011, T037, T038, T050 |
| FR-009 histórico ante archivado | T006, T046 |
| FR-010 idempotencia | T014, T015, T025, T034, T043 |
| SC-001 pedido con líneas y total | T019, T020, T024, T051, T052 |
| SC-002 snapshot persistente | T006, T046 |
| SC-003 acceso solo propio | T011, T039, T050 |
| SC-004 sin pedido duplicado | T015, T034, T043 |