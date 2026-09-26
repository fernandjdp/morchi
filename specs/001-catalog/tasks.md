# Tasks: Catálogo de productos (001-catalog)

Feature Branch: `001-catalog`
Plan: [`plan.md`](./plan.md) · Spec: [`spec.md`](./spec.md)
Fecha: 2026-09-20
Estado: Draft

Tareas ordenadas por fases. Cada tarea tiene checkbox, rutas de archivo concretas y referencias a
`FR-xxx`/`SC-xxx`. Alineado con la constitución v1.0.0 (§V: unit, integración/RLS y E2E) y con
`ARCHITECTURE.md`.

Convenciones:
- `[P]` = puede ejecutarse en paralelo con otras tareas de la misma fase.
- Rutas relativas a la raíz del repo (proyecto root-based, alias `@/*`).

---

## Fase 0 — Setup

- [ ] **T001** Instalar y configurar Vitest (dependencias, `vitest.config.ts`) y agregar scripts `test`, `test:unit` en `package.json`. (§V)
- [ ] **T002** [P] Instalar y configurar Playwright (`playwright.config.ts`) y agregar script `test:e2e` en `package.json`. (§V)
- [ ] **T003** [P] Agregar `remotePatterns` de Supabase Storage en `next.config.mjs` para usar `next/image` con el bucket `product-images`.
- [ ] **T004** [P] Verificar variables de entorno en `.env.example` y `lib/env.ts`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. (§IV)
- [ ] **T005** Inicializar Supabase local/CLI y generar `types/database.types.ts` a partir del esquema. (Soporta FR-001..FR-010)

---

## Fase 1 — Migraciones y RLS

- [ ] **T006** Crear `supabase/migrations/20260920000001_catalog.sql` con las tablas `sizes` y `colors` (name unique, sort_order). (FR-003)
- [ ] **T007** Agregar a `20260920000001_catalog.sql` la tabla `categories` con `slug` unique y `parent_id` autorreferente. (FR-005)
- [ ] **T008** Agregar a `20260920000001_catalog.sql` la tabla `products` con `slug` unique, `status` check `('draft','active','archived')`, `deleted_at`. (FR-001, FR-008)
- [ ] **T009** Agregar a `20260920000001_catalog.sql` la tabla `product_variants` con FK a `products`/`sizes`/`colors`, `sku` unique, `price`/`compare_at_price` `numeric(12,2)` check `>= 0`, `is_active`, y `unique(product_id, size_id, color_id)`. (FR-002, FR-003, FR-004, FR-009, SC-002)
- [ ] **T010** Agregar a `20260920000001_catalog.sql` la tabla `product_categories` con PK compuesta. (FR-005)
- [ ] **T011** Agregar a `20260920000001_catalog.sql` la tabla `product_images` con `storage_path`, `alt_text`, `sort_order` y FK a `products`/`product_variants`. (FR-006)
- [ ] **T012** Agregar en `20260920000001_catalog.sql` los índices de consultas frecuentes (`products.slug`, `products.status`, `product_categories.category_id`, `product_images.product_id`, `product_variants.product_id`) y los grants a `anon`/`authenticated`/`service_role`. (§III)
- [ ] **T013** Habilitar RLS (`enable row level security`) en todas las tablas del catálogo dentro de `20260920000001_catalog.sql`. (§III)
- [ ] **T014** Definir en `20260920000001_catalog.sql` políticas `SELECT` para `anon`/`authenticated` limitadas a productos `status = 'active'` y no borrados, variantes `is_active = true` y categorías/imágenes asociadas. (FR-010)
- [ ] **T015** Definir en `20260920000001_catalog.sql` políticas de escritura (INSERT/UPDATE/DELETE) reservadas a rol administrativo/backend autorizado, y restringir el grant de `cost_price` a nivel de columnas. (§III, FR-001)
- [ ] **T016** Crear la migración de Storage con las políticas del bucket `product-images` (lectura pública de objetos publicados; escritura server-side autorizada). (§IV)
- [ ] **T017** [P] Crear `supabase/seed.sql` con talles, colores, categorías y productos de ejemplo en estados `draft`, `active` y `archived`. (Soporta SC-003, SC-004)

---

## Fase 2 — Dominio / Queries

- [ ] **T018** Crear `features/catalog/types/catalog.types.ts` con `ProductStatus`, `CategoryView`, `ProductListItem`, `ProductVariantView`, `ProductDetail`. (FR-001..FR-006)
- [ ] **T019** [P] Crear `features/catalog/schemas/catalog.schema.ts` con schemas Zod de filtros de listado y de mutaciones de administración. (§II, §IV)
- [ ] **T020** Implementar `features/catalog/queries/list-products.ts` (`listProducts`): filtra `status = 'active'`, calcula `priceFrom` desde variantes activas, aplica filtro por categoría y paginación. (FR-010, SC-001, SC-003)
- [ ] **T021** Implementar `features/catalog/queries/get-product.ts` (`getProductBySlug`): devuelve `null` si no existe o no está `active`; incluye imágenes ordenadas por `sort_order`, variantes activas y categorías. (FR-006, FR-010, SC-001)
- [ ] **T022** [P] Implementar `features/catalog/queries/list-categories.ts` (`listCategories`) con jerarquía (`parent_id`). (FR-005)
- [ ] **T023** [P] Implementar `features/catalog/queries/list-taxonomies.ts` (`listSizes`, `listColors`) ordenadas por `sort_order`. (FR-003)
- [ ] **T024** Implementar `features/catalog/services/catalog-service.ts`: composición de queries y mapeo DB → view models, usando `lib/supabase/server.ts` (RLS, sin admin). (FR-010, §II)
- [ ] **T025** Implementar `features/catalog/actions/admin-product-actions.ts` con Server Functions `createProduct`, `updateProduct`, `publishProduct`, `archiveProduct`, `reorderProductImages`, con validación Zod y autorización server-side. (FR-001, FR-006, FR-008, SC-004)
- [ ] **T026** En `admin-product-actions.ts`, impedir publicar un producto sin al menos una variante vendible y traducir la violación de `sku` unique a error de validación. (FR-002, SC-003, edge cases)
- [ ] **T027** Agregar revalidación selectiva de rutas de catálogo tras publicar/archivar (no invalidación global). (§VII, SC-004)

---

## Fase 3 — UI Server / Client

- [ ] **T028** Crear `app/(store)/layout.tsx` con shell de tienda (nav de categorías y footer) accesible. (§VII)
- [ ] **T029** [P] Crear `features/catalog/components/product-card.tsx` (server) con nombre, imagen principal y precio desde. (SC-001)
- [ ] **T030** [P] Crear `features/catalog/components/product-grid.tsx` (server) que renderiza el listado. (SC-001)
- [ ] **T031** Crear `app/(store)/productos/page.tsx`: listado de productos activos con filtro por categoría y paginación, leyendo vía `catalog-service.ts`. (FR-010, SC-001)
- [ ] **T032** Crear `features/catalog/components/product-gallery.tsx` (server) con imágenes ordenadas por `sort_order` y primera imagen como principal. (FR-006)
- [ ] **T033** Crear `features/catalog/components/variant-selector.tsx` (client) para seleccionar talle/color, accesible por teclado, sin reglas de negocio ni fetch directo a Supabase. (FR-003, FR-009, §II)
- [ ] **T034** Crear `features/catalog/components/product-detail.tsx` (server) que compone galería y selector de variante. (SC-001)
- [ ] **T035** Crear `app/(store)/productos/[slug]/page.tsx`: detalle de producto con `getProductBySlug`; `notFound()` si no está publicado. (FR-010, SC-001)
- [ ] **T036** [P] Crear `features/catalog/components/category-nav.tsx` (server) y `app/(store)/categorias/[slug]/page.tsx` con listado filtrado. (FR-005, SC-001)
- [ ] **T037** [P] Crear `app/(store)/page.tsx` (home) con catálogo destacado. (SC-001)
- [ ] **T038** Integrar `next/image` con el bucket `product-images` y estados de loading/error accesibles. (§VII)
- [ ] **T039** Configurar cache/revalidación del catálogo público en las rutas de listado y detalle. (§VII)
- [ ] **T040** [P] Crear `app/admin/productos/page.tsx` con formularios mínimos de alta/edición/publicación/archivado usando las Server Functions. (FR-001, FR-008, US3)
- [ ] **T041** [P] Crear `app/(store)/not-found.tsx` (o equivalente por ruta) con mensaje accesible para producto no publicado/inexistente. (§VII, FR-010)

---

## Fase 4 — Tests

- [ ] **T042** [P] Unit: `tests/unit/catalog/catalog-schema.test.ts` para validaciones Zod de filtros y mutaciones. (§V)
- [ ] **T043** [P] Unit: `tests/unit/catalog/catalog-mappers.test.ts` para mapeo DB → view models (imágenes ordenadas, variantes activas, categorías). (FR-006, FR-010)
- [ ] **T044** [P] Unit: `tests/unit/catalog/price-from.test.ts` para el cálculo de `priceFrom` desde variantes activas. (SC-003)
- [ ] **T045** Integration: `tests/integration/catalog/list-products.test.ts` contra Supabase aislado (filtro por categoría, solo `active`). (FR-010, SC-001)
- [ ] **T046** Integration/RLS: `tests/integration/catalog/catalog-rls.test.ts` con casos permitidos y denegados para `anon`, `authenticated` y admin (productos `draft`/`archived` invisibles; escritura denegada a no-admin). (FR-010, §III)
- [ ] **T047** RLS SQL: `supabase/tests/catalog_rls.test.sql` ejecutable con `supabase test db`. (§V, §III)
- [ ] **T048** E2E: `tests/e2e/catalog/browse-catalog.spec.ts` — visitante abre catálogo, ve solo publicados y accede al detalle en una navegación. (SC-001, US1)
- [ ] **T049** E2E: `tests/e2e/catalog/select-variant.spec.ts` — selección de combinación válida identifica una única variante; combinación inexistente/inactiva no es comprable. (FR-003, FR-009, US2)
- [ ] **T050** Test de publicación/archivado: verificar que publicar exige variante vendible y que archivar mantiene la referencia histórica sin borrar el producto. (FR-008, SC-003, SC-004)

---

## Fase 5 — Verificación

- [ ] **T051** Ejecutar `lint` y `typecheck` (agregar scripts si faltan) y corregir hallazgos. (§VII, workflow)
- [ ] **T052** Ejecutar `test` (Vitest) y `test:e2e` (Playwright) en verde. (§V)
- [ ] **T053** Ejecutar `build` de Next.js para validar el target Vercel. (workflow)
- [ ] **T054** Validar migraciones desde una base limpia (`supabase db reset`) y verificar reproducibilidad. (§III)
- [ ] **T055** Verificar RLS y grants manualmente/automatizada para el catálogo, incluyendo storage. (§III, §IV)
- [ ] **T056** Revisar que no haya secretos en archivos nuevos/modificados ni en logs; confirmar que `admin.ts` sigue server-only. (§IV)
- [ ] **T057** Revisar accesibilidad de listado, detalle y selector de variante (labels, teclado, foco, estados no solo por color). (§VII)
- [ ] **T058** Regenerar `types/database.types.ts` si cambió el esquema y confirmar que el typecheck sigue pasando. (workflow)
- [ ] **T059** Actualizar el estado de `ROADMAP.md` para `001-catalog` cuando la verificación cierre. (governance)

---

## Integración de carga de imágenes a Supabase Storage

La implementación se guía por “Integración de carga de imágenes en Supabase Storage” en
[`plan.md`](./plan.md). T060 ya se completó en esta entrega; el resto delimita la integración y
validación que queda para cerrar esa capacidad.

- [x] **T060** [P] Añadir previsualización local previa al envío, feedback accesible para formato/tamaño y liberación de URL temporal en el formulario de edición de producto. (FR-011)
- [ ] **T061** Verificar en entorno Supabase aislado creación del bucket y policies: lectura pública según el catálogo y escritura no disponible para usuarios no autorizados. (§III, §IV)
- [ ] **T062** Cubrir en tests del formulario los tipos permitidos/denegados, límite de 5 MiB, reemplazo de selección y limpieza de preview URL. (FR-011, §V)
- [ ] **T063** Cubrir subida en integración: ruta bajo ID de producto con UUID, MIME y `upsert: false`; rechazo server-side de entrada inválida y eliminación del objeto al fallar el registro en `product_images`. (FR-011, §III, §IV)
- [ ] **T064** Medir imágenes reales de administración y decidir si se incorpora compresión/redimensionamiento cliente o Image Transformations; registrar límites y conservar original como referencia canónica. (Plan §2)
- [ ] **T065** Revisar manejo accesible de error de carga y revalidación de la galería tras subida exitosa. (§VII)

## Trazabilidad FR/SC → tareas

| Requisito | Tareas |
|---|---|
| FR-001 estados `draft`/`active`/`archived` | T008, T015, T025, T040 |
| FR-002 SKU único | T009, T026, T050 |
| FR-003 variante ↔ talle/color | T006, T009, T023, T033, T049 |
| FR-004 sin combinaciones duplicadas | T009 |
| FR-005 categorías jerárquicas y N:M | T007, T010, T022, T036 |
| FR-006 imágenes con orden determinista | T011, T021, T025, T032, T043 |
| FR-007 precio de catálogo vs. histórico | T009, T020 (snapshot de pedido en 004) |
| FR-008 archivar sin borrar referencias | T008, T025, T050 |
| FR-009 variante inactiva no comprable | T009, T020, T033, T049 |
| FR-010 solo publicado para no autenticados | T014, T020, T021, T024, T031, T035, T046 |
| SC-001 catálogo → detalle en una acción | T029, T030, T031, T034, T035, T048 |
| SC-002 100% variantes activas con SKU | T009, T042, T046 |
| SC-003 producto visible con variante vendible | T017, T020, T026, T044, T050 |
| SC-004 publicación/archivado consistente | T025, T027, T050 |
