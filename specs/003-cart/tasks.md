# Tasks: Carrito de compra (003-cart)

Feature Branch: `003-cart`
Plan: [`plan.md`](./plan.md) · Spec: [`spec.md`](./spec.md)
Fecha: 2026-09-20
Estado: Draft

Referencias de gobierno:
- `.specify/memory/constitution.md` v1.0.0 (principios I–VII), con foco en §II (server-first),
  §III (RLS/integridad), §IV (secretos), §V (tests) y §VI (idempotencia).
- `ARCHITECTURE.md` (server-first, Server Functions, RLS, idempotencia, migraciones versionadas).
- `specs/003-cart/spec.md` (FR-001..FR-009, SC-001..SC-004).
- Dependencias: 001 (catálogo), 002 (clientes/invitado), 004 (checkout/pedidos), 005 (pagos),
  006 (inventario).

Formato: `[ ]` pendiente, `[x]` completada. `[P]` indica tarea paralelizable dentro de su fase.
Tareas de tests son **bloqueantes de release** (constitución §V): la feature no se cierra con tests
ausentes o fallando sin justificación documentada.

Convenciones:
- Rutas relativas a la raíz del repo (proyecto root-based, alias `@/*`, sin `src/`).
- Las migraciones de datos ya presentes en el repo se validan/ajustan; no se recrean ni se modifican
  manualmente bases remotas.

---

## Fase 0 — Setup

- [x] **T001** Confirmar el runner de tests del repo (`package.json`). Hoy solo existen `dev`,
  `build`, `start` y `typecheck`. Ref: constitución §V.
- [ ] **T002** [P] Incorporar y configurar Vitest (`vitest.config.ts`) y scripts `test`/`test:unit`
  en `package.json`. Ref: constitución §V.
- [ ] **T003** [P] Incorporar y configurar Playwright (`playwright.config.ts`) y script `test:e2e` en
  `package.json`. Ref: constitución §V.
- [x] **T004** Confirmar los clientes Supabase existentes: `lib/supabase/server.ts` (sesión/identidad)
  y `lib/supabase/admin.ts` (`server-only`, `SUPABASE_SECRET_KEY`). Ref: constitución §IV.
- [ ] **T005** Verificar en `.env.example` y `lib/env.ts` las variables necesarias:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
  (server-only) y `NEXT_PUBLIC_SITE_URL`. Ref: constitución §IV.
- [ ] **T006** Regenerar `types/database.types.ts` desde el esquema que incluye `carts` y `cart_items`
  y confirmar que el typecheck pasa. (Soporta FR-001..FR-009)

---

## Fase 1 — Migración, constraints y RLS

Ruta: `supabase/migrations/20260920000007_cart.sql` (ya presente).

- [x] **T101** Confirmar la tabla `carts` con `user_id`, `session_token`, `status`
  `check ('active','converted','abandoned')` y `carts_owner_present`. Ref: FR-001, FR-009.
- [x] **T102** Confirmar los índices únicos parciales de carrito activo por `user_id` y por
  `session_token`. Ref: FR-001, SC-001.
- [x] **T103** Confirmar la tabla `cart_items` con `unique(cart_id, variant_id)`, `check (quantity > 0)`
  y FK a `carts`/`product_variants`. Ref: FR-002, FR-003, FR-005.
- [x] **T104** Confirmar el índice `cart_items_cart_idx (cart_id)`. Ref: `ARCHITECTURE.md` §26.
- [ ] **T105** Verificar RLS en `carts`: `SELECT`/`INSERT`/`UPDATE` para `authenticated` solo con
  `user_id = auth.uid()`, sin `DELETE`; `anon` sin grant ni policy. Ref: FR-001, constitución §III.
- [ ] **T106** Verificar RLS en `cart_items`: operaciones para `authenticated` solo si el `cart` padre
  es propio; `anon` sin grant ni policy; `service_role` con bypass (carrito anónimo). Ref: FR-001,
  FR-002, constitución §III.
- [ ] **T107** Validar la migración desde una base limpia (`supabase db reset`) y confirmar
  reproducibilidad e idempotencia. Ref: `ARCHITECTURE.md` §22.
- [ ] **T108** [P] Crear `supabase/tests/cart_rls.test.sql` ejecutable con `supabase test db`:
  permitido/denegado para `anon` y `authenticated` (carrito propio vs. ajeno). Ref: FR-001, §III.

---

## Fase 2 — Dominio y contrato

- [ ] **T201** Crear `features/cart/types/cart.types.ts` con `CartStatus`, `CartIdentity`, `CartView`,
  `CartLineView`, `AddCartItemInput`, `UpdateCartItemInput`, `RemoveCartItemInput`, `CartErrorCode` y
  `CartActionResult`. Ref: FR-001..FR-005.
- [ ] **T202** [P] Crear `features/cart/schemas/cart.schema.ts` (Zod): `variantId` uuid, `quantity`
  entero `1..99`, `itemId` uuid. Ref: FR-005; `AGENTS.md` §9.8.
- [ ] **T203** Implementar `getCart(identity)` en `features/cart/services/cart-service.ts`: devuelve el
  carrito activo con líneas unidas al catálogo (nombre/descripción/SKU/precio informativos) o `null`.
  Ref: FR-001, FR-002, FR-008.
- [ ] **T204** Implementar `addCartItem(input, identity)`: obtener/crear carrito activo; validar
  variante activa + producto activo + no borrado + disponibilidad suficiente; upsert de línea
  (`unique(cart_id, variant_id)`) incrementando cantidad si ya existe. Ref: FR-001, FR-002, FR-003,
  FR-006, SC-001.
- [ ] **T205** Implementar `updateCartItem(input, identity)`: verificar ownership de la línea y aplicar
  la nueva cantidad (`>= 1`). Ref: FR-004, FR-005.
- [ ] **T206** Implementar `removeCartItem(input, identity)`: verificar ownership y eliminar la línea.
  Ref: FR-004.
- [ ] **T207** Rechazar toda operación sobre un carrito con `status <> 'active'` devolviendo
  `CART_NOT_ACTIVE`. Ref: FR-009.
- [ ] **T208** Asegurar que el servicio use `lib/supabase/admin.ts` (server-only) y que la identidad
  se reciba ya resuelta, sin aceptar `user_id`/`cart_id` del cliente como autoridad. Ref: constitución
  §II/§III/§IV.
- [ ] **T209** Mantener `cart_items` con solo `variant_id` y `quantity` (sin copiar nombre/descripción
  del catálogo). Ref: FR-008.

---

## Fase 3 — Server Actions e identidad

Ruta: `features/cart/actions/cart-actions.ts`.

- [ ] **T301** Implementar `ensureCartSession()`: si no existe cookie `morchi_cart_token`, generar un
  uuid (`crypto.randomUUID()`) y setear una cookie `httpOnly`, `sameSite: 'lax'`, `secure` en
  producción, `path: '/'`. Ref: FR-001, constitución §IV.
- [ ] **T302** Implementar la resolución de identidad server-side: `getUser()` (Sesión Supabase) o la
  cookie `morchi_cart_token`; nunca un `user_id` enviado por el cliente. Ref: FR-001, `ARCHITECTURE.md`
  §8.
- [ ] **T303** [P] Implementar `addCartItem(input)` como Server Action: validar con Zod, resolver
  identidad, invocar el servicio y devolver `CartActionResult`. Ref: FR-001..FR-003, FR-006.
- [ ] **T304** [P] Implementar `updateCartItem(input)` como Server Action (Zod + identidad + servicio).
  Ref: FR-004, FR-005.
- [ ] **T305** [P] Implementar `removeCartItem(input)` como Server Action (Zod + identidad + servicio).
  Ref: FR-004.
- [ ] **T306** Mapear errores de dominio esperados a `CartActionResult` sin filtrar detalles internos
  ni secretos. Ref: `AGENTS.md` §9.9, constitución §VII.
- [ ] **T307** Revalidar selectivamente (`revalidatePath`) las rutas afectadas tras cada mutación; no
  usar invalidación global. Ref: `ARCHITECTURE.md` §13.

---

## Fase 4 — UI

- [ ] **T401** Crear `components/store/cart-drawer.tsx` (Client Component): listar líneas, cambiar
  cantidad, eliminar, mostrar subtotal informativo y enlazar a `/checkout`. Ref: FR-002, FR-004,
  SC-002.
- [ ] **T402** Conectar el drawer a las Server Actions (`addCartItem`, `updateCartItem`,
  `removeCartItem`) con estados de carga, error y éxito; sin reglas de negocio en el cliente. Ref:
  constitución §II.
- [ ] **T403** Hacer el drawer accesible: labels, operación por teclado, foco visible, mensajes de
  validación legibles, indicadores no dependientes solo del color. Ref: constitución §VII.
- [ ] **T404** Crear `app/(store)/checkout/page.tsx` (Server Component): resumen del carrito vía
  `getCart` y formulario de email; estado vacío si no hay carrito activo o sin líneas. Ref: FR-007,
  `004-checkout-orders` US1.
- [ ] **T405** Aclarar en la UI que el precio mostrado es informativo y se confirma al crear el pedido
  (assumption de la spec). Ref: assumption de `spec.md`.
- [ ] **T406** Comunicar en checkout la invalidación parcial si el stock disminuyó o un producto fue
  archivado, sin ocultar el problema. Ref: edge cases de la spec, FR-007.

---

## Fase 5 — Integración con checkout

Ruta: `features/checkout/services/checkout-cart.ts`.

- [ ] **T501** Implementar `checkoutCart({ email, idempotencyKey })`: resolver identidad, cargar las
  líneas del carrito activo server-side y delegar en la RPC `create_checkout_order`. Ref: FR-007,
  SC-004.
- [ ] **T502** Confirmar que la RPC revalida disponibilidad y estado de cada variante antes de crear
  el pedido, y que fija el precio definitivo. Ref: FR-007, SC-004.
- [ ] **T503** Confirmar la conversión del carrito `carts.status = 'converted'` dentro de la
  transacción de checkout, impidiendo una segunda conversión. Ref: FR-009, SC-003.
- [ ] **T504** Confirmar la idempotencia del checkout por `orders.idempotency_key`: un reintento no
  crea un segundo pedido ni vuelve a reservar stock. Ref: SC-003, `004-checkout-orders` FR-010.
- [ ] **T505** Conectar `app/(store)/checkout/page.tsx` con `checkoutCart` y manejar los errores de
  dominio esperados (carrito vacío, variante no comprable, stock insuficiente). Ref: FR-006, FR-007.

---

## Fase 6 — Tests (bloqueantes, constitución §V)

### Unit (Vitest)

- [ ] **T601** [P] `tests/unit/cart/cart-schema.test.ts`: rechazo de cantidad < 1, no entera o > 99, y
  de `variantId`/`itemId` no uuid. Ref: FR-005.
- [ ] **T602** [P] `tests/unit/cart/cart-identity.test.ts`: resolución de identidad (usuario
  autenticado vs. cookie `morchi_cart_token`; nunca un `user_id` del cliente). Ref: FR-001.
- [ ] **T603** [P] `tests/unit/cart/cart-totals.test.ts`: subtotal informativo coherente con las
  líneas actuales y estable frente a cambios de otras líneas. Ref: SC-002.

### Integración / RLS (base de test aislada)

- [ ] **T604** `tests/integration/cart/cart-service.test.ts`: alta, modificación y eliminación de
  líneas; `addCartItem` duplicado incrementa cantidad y no duplica línea. Ref: FR-002, FR-003, FR-004,
  SC-001.
- [ ] **T605** `tests/integration/cart/cart-buyability.test.ts`: variante inactiva, producto no activo
  o stock insuficiente son rechazados al agregar. Ref: FR-006.
- [ ] **T606** `tests/integration/cart/cart-anonymous.test.ts`: un carrito anónimo se crea y recupera
  mientras la sesión (cookie) es válida. Ref: FR-001, US3.
- [ ] **T607** `tests/integration/cart/cart-rls.test.ts`: un usuario autenticado no puede leer ni
  modificar `carts`/`cart_items` de otro; `anon` no accede a las tablas. Ref: FR-001, constitución §III.
- [ ] **T608** Integración de conversión: reconvertir el mismo carrito es rechazado y el estado final
  impide una segunda conversión. Ref: FR-009, SC-003.
- [ ] **T609** Integración de disponibilidad final: una línea que dejó de ser comprable entre el
  carrito y el checkout no permite crear el pedido. Ref: FR-007, SC-004.
- [ ] **T610** RLS SQL (si aplica): ejecutar `supabase/tests/cart_rls.test.sql` con `supabase test db`.
  Ref: constitución §V/§III.

### E2E (Playwright)

- [ ] **T611** `tests/e2e/cart/add-to-cart.spec.ts`: desde el detalle de producto, agregar una variante
  válida y encontrarla en el drawer con la cantidad pedida. Ref: SC-001, US1.
- [ ] **T612** `tests/e2e/cart/modify-cart.spec.ts`: incrementar, reducir y eliminar líneas; el total
  mostrado se recalcula y las demás líneas no cambian. Ref: SC-002, US2.
- [ ] **T613** `tests/e2e/cart/cart-to-checkout.spec.ts`: drawer → `/checkout` con formulario de email
  y resumen del carrito. Ref: FR-007, US1/US2.

---

## Fase 7 — Verificación y cierre

- [ ] **T701** Ejecutar `lint` y `typecheck` (agregar scripts si faltan) y corregir hallazgos.
  Ref: `AGENTS.md` §13.
- [ ] **T702** Ejecutar `test` (Vitest) y `test:e2e` (Playwright) en verde. Ref: constitución §V.
- [ ] **T703** Ejecutar `build` de Next.js para validar el target Vercel. Ref: workflow.
- [ ] **T704** Validar la migración desde base limpia y las policies RLS permitidas/denegadas.
  Ref: `ARCHITECTURE.md` §21/§22, constitución §III.
- [ ] **T705** Confirmar que `lib/supabase/admin.ts` sigue `server-only` y que no hay secretos ni
  tokens en archivos nuevos/modificados ni en logs. Ref: constitución §IV; `AGENTS.md` §20.
- [ ] **T706** Revisar accesibilidad del drawer y de `/checkout` (labels, teclado, foco, estados no
  solo por color). Ref: constitución §VII.
- [ ] **T707** Revisar `git status`/`git diff` para confirmar que no hay cambios fuera de alcance.
  Ref: `AGENTS.md` §22.
- [ ] **T708** Revisión de convergencia contra `spec.md` (FR-001..FR-009, SC-001..SC-004) y Definition
  of Done (`AGENTS.md` §14); documentar cualquier hueco pendiente.
- [ ] **T709** Actualizar el estado de `ROADMAP.md` para `003-cart` cuando la verificación cierre.
  Ref: governance.

---

## Trazabilidad FR/SC → tareas

| Requisito | Tareas |
|---|---|
| FR-001 carrito activo por usuario o sesión anónima | T101, T102, T105, T106, T201, T203, T301, T302, T606 |
| FR-002 línea identificada por variante | T103, T201, T203, T209, T604 |
| FR-003 sin líneas duplicadas de la misma variante | T103, T204, T604 |
| FR-004 cambiar cantidad y eliminar | T205, T206, T304, T305, T401, T604, T612 |
| FR-005 rechazar cantidad < 1 | T103, T202, T205, T304, T601 |
| FR-006 validar comprabilidad al agregar | T204, T303, T605 |
| FR-007 revalidar disponibilidad antes de checkout | T404, T406, T501, T502, T505, T609 |
| FR-008 estado del carrito independiente del catálogo | T201, T203, T209 |
| FR-009 ciclo de vida active/converted/abandoned | T101, T207, T503, T608 |
| SC-001 una línea activa por variante válida | T102, T204, T604, T611 |
| SC-002 total coherente con las líneas actuales | T401, T603, T612 |
| SC-003 impedir conversión doble del carrito | T503, T504, T608 |
| SC-004 validación final antes de crear el pedido | T502, T505, T609 |