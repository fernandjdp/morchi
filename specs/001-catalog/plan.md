# Plan Técnico: Catálogo de productos (001-catalog)

Feature Branch: `001-catalog`
Spec: [`spec.md`](./spec.md)
Fecha: 2026-09-20
Estado: Draft

Este plan traduce la especificación funcional del catálogo a decisiones técnicas concretas.
Respeta las decisiones ya fijadas en `.specify/memory/constitution.md` (v1.0.0) y `ARCHITECTURE.md`,
y no introduce comportamiento ausente en `spec.md`.

---

## 1. Summary

El catálogo es el primer módulo del ecommerce y su responsabilidad es **publicar y consultar
información comercial vendible**: productos, variantes (talle/color), categorías e imágenes.

Alcance técnico:

- Migraciones versionadas que crean el esquema de catálogo en Supabase PostgreSQL con constraints,
  índices, grants y RLS explícitos.
- Lectura pública server-side (Server Components) a través del cliente Supabase SSR con RLS,
  sin usar la secret key.
- Capa de dominio `features/catalog/` con queries tipadas, separada del renderizado React.
- UI server-first para listado, detalle, categorías y galería; un Client Component acotado para la
  selección interactiva de variante.
- Administración de contenido de producto (crear/editar/categorizar/ordenar/publicar/archivar) como
  capacidad P2, usando Server Functions y autorización server-side.
- Tests unitarios (Vitest), de integración/RLS y E2E (Playwright) según la constitución §V.

Fuera de este módulo: stock transaccional, checkout, pagos, envíos, diseños y promociones
(ver §9 y `ROADMAP.md`).

---

## 2. Technical Context

### Integración de carga de imágenes en Supabase Storage

**Estado del plan:** la carga base ya existe en `features/backoffice/actions/products.ts` y usa el
bucket público `product-images`, rutas `{product-id}/{uuid}.{ext}`, MIME explícito, `upsert: false`
y caché de un año. El formulario de edición ofrece una previsualización local antes del envío.

#### Flujo objetivo

1. El administrador selecciona JPG, PNG o WebP. El formulario cliente valida MIME y tamaño
   (máximo 5 MiB) y genera una URL temporal con `URL.createObjectURL` para previsualizar; al
   cambiar de archivo o desmontar el componente, revoca la URL temporal.
2. Se muestra nombre/tamaño, texto alternativo y una acción de carga accesible. No se transfiere
   nada hasta enviar el formulario.
3. La Server Action vuelve a validar sesión/rol, UUID de producto, tamaño y MIME; genera un UUID
   nuevo bajo el prefijo del producto; sube con `contentType`, `cacheControl` y `upsert: false`.
4. Se registra `storage_path` y texto alternativo en `product_images`. Si falla la inserción de
   metadatos, se elimina el objeto recién cargado para evitar huérfanos.
5. Se revalidan las rutas de administración para que la galería muestre el objeto persistido.

#### Etapas de integración

- **A. Experiencia y validación de entrada (implementada):** preview local previa a la carga,
  MIME permitido y límite de 5 MiB visibles en el formulario; la validación cliente solo mejora
  la experiencia y no sustituye controles server-side.
- **B. Persistencia y seguridad (base implementada):** mantener el bucket `product-images`, las
  rutas por producto con UUID, MIME explícito, `upsert: false`, autorización de administrador y
  compensación al fallar la escritura de metadatos. Confirmar en integración que bucket/policies
  limitan la escritura a la ruta administrativa y permiten lectura pública solo según el diseño
  de catálogo.
- **C. Optimización de medios (siguiente iteración):** medir imágenes habituales; si el peso real
  justifica el costo, agregar compresión/redimensionamiento en cliente con una dependencia evaluada
  y límites de dimensiones, conservando el MIME real del archivo resultante. Evaluar Supabase Image
  Transformations para servir variantes optimizadas; no persistir URLs firmadas ni derivados como
  fuente de verdad. Mantener el original en Storage salvo decisión funcional explícita.
- **D. Calidad y observabilidad:** cubrir validación permitida/denegada, preview/revocación y
  rollback de objeto si falla el registro; informar errores sin exponer detalles del proveedor.

#### Decisiones y límites

- El navegador genera solo una URL de previsualización local; no sube directamente ni recibe claves
  privilegiadas. La Server Action existente conserva autenticación y escritura con cliente admin.
- El UUID evita colisiones y permite caché larga e inmutable por objeto. Cambios de imagen crean
  otro path, por lo que el CDN no sirve contenido anterior bajo la misma URL.
- Se conserva el tope actual de 5 MiB y los formatos JPG/PNG/WebP. La compresión automática y las
  transformaciones de entrega quedan planificadas, no se incorporan sin medir calidad y tamaño.
- La tabla `product_images` guarda metadatos/referencia, nunca bytes. El bucket debe permanecer
  versionado por migraciones y su política debe corresponder al acceso administrativo.

#### Constitución / arquitectura

Cumple server-first con un Client Component pequeño para `File`, estado y APIs del navegador;
la mutación continúa en servidor con autorización propia (§II, §IV). Los archivos permanecen en
Storage, con ruta segura, límites de tamaño/tipo y metadatos en PostgreSQL (§III, §IV). La preview
usa controles etiquetados y mensajes de validación accesibles (§VII). El plan sigue la FR-011 de
`spec.md`; no agrega cambios de esquema ni secretos en cliente.

### Lenguaje y runtime

- **TypeScript** obligatorio (strict) sobre **Next.js App Router** (`next@16`, React 19).
- Proyecto **root-based**: no se usa carpeta `src/`. El alias `@/*` apunta a la raíz
  (`tsconfig.json` → `"paths": { "@/*": ["./*"] }`).

### Estructura de proyecto (decidida)

- `app/` expresa rutas y composición de páginas.
- `features/` contiene capacidades de negocio (aquí `features/catalog/`).
- `lib/` contiene infraestructura transversal, incluido `lib/supabase/`.
- `types/database.types.ts` contiene los tipos generados desde el esquema.

### Dependencias relevantes

| Dependencia | Uso |
|---|---|
| `@supabase/ssr` | Cliente SSR con sesión por cookies y RLS |
| `@supabase/supabase-js` | Cliente base (admin server-only) |
| `next` | App Router, Server Components, Server Functions, `next/image`, cache/revalidación |
| `zod` | Validación de inputs de administración y contratos |
| `tailwindcss` + `components/ui` | Estilos y componentes accesibles |
| `server-only` | Bloquea el cliente admin en el bundle del navegador |

Aún **no instalados** (se agregan en la fase de Setup): `vitest`, `@playwright/test`,
`@testing-library/react` y utilidades asociadas.

### Clientes Supabase (ya existentes)

- `lib/supabase/server.ts` → `createClient()`: cliente SSR con cookies, **respeta RLS** (clave
  publicable). Es el único cliente autorizado para leer el catálogo público.
- `lib/supabase/browser.ts` → `createClient()`: cliente de Client Components, solo clave publicable.
- `lib/supabase/admin.ts` → `createAdminClient()`: **server-only**, usa `SUPABASE_SECRET_KEY` y
  hace bypass de RLS. No se usa para lecturas públicas del catálogo; queda reservado para
  operaciones administrativas que lo requieran.

### Variables de entorno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only, sin prefijo `NEXT_PUBLIC_`)

Acceso centralizado en `lib/env.ts`. Ninguna clave secreta llega al navegador (constitución §IV).

### Storage

- Bucket de Supabase Storage: **`product-images`**, organizado por `{product-id}/...`.
- En base de datos solo se persiste `storage_path` (texto). No se guardan binarios en PostgreSQL.
- Las políticas del bucket se definen en la migración de RLS del catálogo (lectura pública de
  objetos publicados; escritura reservada a administración autorizada).

### Testing

- **Vitest** para lógica de dominio, transformaciones de queries y schemas Zod.
- **Tests de integración/RLS** contra un entorno Supabase aislado (local/CI), incluyendo casos
  permitidos y denegados.
- **Playwright** para los journeys críticos de catálogo (listado → detalle → selección de variante).

### Plataforma objetivo

- **Vercel** para hosting, previews y producción. El build debe pasar typecheck, lint, tests y
  `next build`. Las migraciones Supabase son un proceso controlado independiente del build de
  frontend (`ARCHITECTURE.md` §25).

### Rendimiento

- Server Components por defecto para reducir JavaScript enviado al cliente.
- Cache/revalidación del catálogo público (datos no específicos de usuario) usando las primitivas
  de Next.js; invalidación selectiva tras mutaciones de administración.
- `next/image` con `remotePatterns` apuntando a Supabase Storage.
- Evitar N+1: una consulta principal por listado con `select` anidado y una sola consulta para el
  detalle con imágenes, variantes y categorías.
- Índices en las consultas frecuentes (`slug`, `status`, `product_categories.category_id`,
  `product_images.product_id`, `product_variants.product_id`).
- Presupuesto práctico del catálogo: el listado debe renderizarse en el servidor sin waterfalls
  de fetching en cascada; paginación simple en el listado.

---

## 3. Constitution Check

Evaluación de los principios I–VII de `.specify/memory/constitution.md` (v1.0.0).

| Principio | Estado | Justificación |
|---|---|---|
| **I. Spec-Driven Modular Architecture** | ✅ Pass | El plan deriva de `spec.md` (FR-001..FR-010, SC-001..SC-004) y respeta límites de módulo. `features/catalog/` es aislado y no invade checkout, inventario, pagos, envíos ni diseños. Referencia a constitución y `ARCHITECTURE.md` sin duplicar decisiones globales. |
| **II. Next.js Server-First Application** | ✅ Pass | Lecturas de catálogo en Server Components vía Supabase SSR; las mutaciones de administración se ejecutan con Server Functions con validación y autorización server-side. El único Client Component es el selector de variante (interactividad local) y no contiene reglas de negocio. |
| **III. Supabase Data Integrity & Security** | ✅ Pass | Esquema creado por migraciones versionadas en `supabase/migrations/`. Constraints de integridad (FK, `sku` unique, `unique(product_id, size_id, color_id)`, `status` check, `price >= 0`, `numeric(12,2)`). RLS habilitado en todas las tablas expuestas con políticas explícitas y grants. |
| **IV. Secure Boundaries & Secrets** | ✅ Pass | Lectura pública con clave publicable + RLS. `SUPABASE_SECRET_KEY` solo en `lib/supabase/admin.ts` (`server-only`). Imágenes en Storage, no en PostgreSQL. Sin secretos en el bundle ni en logs. |
| **V. Test-Backed Quality** | ✅ Pass | Plan incluye unit tests (Vitest) de dominio/schemas, tests de integración/RLS de casos permitidos y denegados, y E2E Playwright de los journeys de catálogo. Ninguna feature se cierra con tests fallando. |
| **VI. Idempotent Commerce & Integration Workflows** | ✅ Pass (N/A acotado) | El catálogo no procesa pagos ni movimientos de stock. FR-007/FR-008 garantizan que la historia de pedidos no dependa del catálogo actual: los precios de pedido viven en `order_items.unit_price` (módulo 004) y archivar no borra referencias. No introduce operaciones repetibles no idempotentes. |
| **VII. Observable, Performant, Accessible Delivery** | ✅ Pass | Cache/revalidación de catálogo público, Server Components, `next/image`, índices y paginación. UI accesible: HTML semántico, labels, navegación por teclado, estados de loading/error, indicadores no dependientes solo del color. Errores de administración registrados sin secretos. |

**Gaps / complejidad:** ninguno bloqueante. Las dependencias de testing (`vitest`, `playwright`) se
incorporan en Setup; no representan una violación, solo trabajo pendiente.

---

## 4. Project Structure

Rutas concretas a crear o editar. Las marcadas con ✏️ ya existen y se reutilizan sin cambios de
contrato.

### Migraciones y datos

```text
supabase/
├── migrations/
│   └── 20260920000001_catalog.sql    # tablas, constraints, índices, grants y RLS del catálogo
├── seed.sql                          # datos de ejemplo: talles, colores, categorías, productos
└── tests/
    └── catalog_rls.test.sql          # tests SQL de RLS (permitido/denegado)
types/
└── database.types.ts                 # tipos generados (supabase gen types)
```

> Nota: la migración de catálogo es un único archivo versionado e idempotente que crea el esquema y
> habilita RLS con políticas y grants explícitos en la misma migración. Las políticas del bucket
> `product-images` se agregan en la migración de Storage correspondiente (puede ser un archivo
> separado dentro de `supabase/migrations/`).

### Dominio

```text
features/catalog/
├── types/
│   └── catalog.types.ts              # ProductStatus, ProductListItem, ProductDetail, etc.
├── schemas/
│   └── catalog.schema.ts             # schemas Zod de filtros y de mutaciones de admin
├── queries/
│   ├── list-products.ts              # listProducts()
│   ├── get-product.ts                # getProductBySlug()
│   ├── list-categories.ts            # listCategories()
│   └── list-taxonomies.ts            # listSizes(), listColors()
├── services/
│   └── catalog-service.ts            # composición de queries + mapeo a view models
├── actions/
│   └── admin-product-actions.ts      # Server Functions de administración (P2)
└── components/
    ├── product-card.tsx              # server
    ├── product-grid.tsx              # server
    ├── product-gallery.tsx           # server
    ├── category-nav.tsx              # server
    ├── product-detail.tsx            # server (compone galería + selector)
    └── variant-selector.tsx          # client (selección talle/color, sin reglas de negocio)
```

### Rutas (App Router)

```text
app/
├── (store)/
│   ├── layout.tsx                    # shell de tienda (nav, footer)
│   ├── page.tsx                      # home/catálogo destacado
│   ├── productos/
│   │   ├── page.tsx                  # listado con filtro por categoría
│   │   └── [slug]/
│   │       └── page.tsx              # detalle de producto
│   └── categorias/
│       └── [slug]/
│           └── page.tsx              # listado por categoría
└── admin/
    └── productos/
        └── page.tsx                  # administración de catálogo (P2)
```

### Reutilización (ya existe)

```text
lib/supabase/server.ts   ✏️  # createClient() SSR con RLS
lib/supabase/browser.ts  ✏️  # createClient() navegador
lib/supabase/admin.ts    ✏️  # createAdminClient() server-only
lib/env.ts               ✏️  # acceso a variables de entorno
components/ui/           ✏️  # primitivas shadcn/ui reutilizables
app/layout.tsx           ✏️  # layout raíz
next.config.mjs          ✏️  # agregar remotePatterns para Supabase Storage
```

### Tests

```text
tests/
├── unit/catalog/
│   ├── catalog-schema.test.ts        # validaciones Zod
│   ├── catalog-mappers.test.ts       # mapeo DB → view models
│   └── price-from.test.ts            # cálculo de "precio desde"
├── integration/catalog/
│   ├── list-products.test.ts         # queries contra Supabase aislado
│   └── catalog-rls.test.ts           # RLS: anon/authenticated/admin
└── e2e/catalog/
    ├── browse-catalog.spec.ts        # listado → detalle (SC-001)
    └── select-variant.spec.ts        # selección de variante (US2)
```

---

## 5. Data Model

Modelo canónico definido en `specs/base.md` §2–§6. Solo se listan tablas y campos relevantes para
el catálogo. Los importes usan `numeric(12,2)`; la moneda del catálogo es implícitamente `ARS`
(la moneda explícita se snapshotea en pedidos, módulo 004).

### `products`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text not null | Nombre comercial |
| `slug` | text unique not null | URL amigable, estable (edge case de spec) |
| `description` | text | Descripción |
| `status` | text not null default `'draft'` | check `in ('draft','active','archived')` → FR-001 |
| `brand` | text | Marca |
| `product_type` | text | Remera, buzo, etc. |
| `created_at` / `updated_at` | timestamptz | Auditoría |
| `deleted_at` | timestamptz | Soft delete |

### `product_variants`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `product_id` | uuid FK → `products(id)` on delete cascade | |
| `size_id` | uuid FK → `sizes(id)` (nullable) | FR-003 |
| `color_id` | uuid FK → `colors(id)` (nullable) | FR-003 |
| `sku` | text not null unique | FR-002, SC-002, edge case |
| `price` | numeric(12,2) not null check `>= 0` | Precio de catálogo → FR-007 |
| `compare_at_price` | numeric(12,2) check `>= 0` | Precio anterior |
| `cost_price` | numeric(12,2) | Restringido a administradores |
| `barcode` | text | |
| `weight_grams` | int | |
| `is_active` | boolean not null default true | FR-009: variante inactiva no comprable |
| `created_at` | timestamptz | |
| — | unique(`product_id`, `size_id`, `color_id`) | FR-004: sin combinaciones duplicadas |

### `sizes`

`id` uuid PK · `name` text not null unique · `sort_order` int not null default 0.

### `colors`

`id` uuid PK · `name` text not null unique · `hex_code` text · `sort_order` int not null default 0.

### `categories`

`id` uuid PK · `name` text not null · `slug` text not null unique · `description` text ·
`parent_id` uuid FK → `categories(id)` (jerarquía) → FR-005.

### `product_categories`

`product_id` uuid FK → `products(id)` on delete cascade · `category_id` uuid FK →
`categories(id)` on delete cascade · PK(`product_id`, `category_id`) → FR-005 (muchos-a-muchos).

### `product_images`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `product_id` | uuid FK → `products(id)` on delete cascade | |
| `variant_id` | uuid FK → `product_variants(id)` on delete set null | Imagen opcional por variante |
| `storage_path` | text not null | Ruta en bucket `product-images`; nunca binario → FR-006 |
| `alt_text` | text | Accesibilidad |
| `sort_order` | int not null default 0 | Orden determinista → FR-006 |
| `created_at` | timestamptz | |

### Invariantes de dominio

- Un producto `active` sin variante `is_active = true` **no debe ofrecerse para compra** (SC-003).
- Archivar (`status = 'archived'`) no elimina el producto ni sus referencias; los pedidos
  históricos siguen siendo reconstruibles (FR-008, constitución §VI).
- El precio de catálogo (`product_variants.price`) es independiente del snapshot histórico de
  pedido (`order_items.unit_price`, módulo 004) → FR-007.

---

## 6. Contracts

Contratos de consulta expuestos por `features/catalog/queries/`. Todos reciben el cliente Supabase
SSR (o lo crean internamente con `lib/supabase/server.ts`) y devuelven datos ya filtrados por RLS.
Las queries de lectura pública **solo** devuelven información publicada (FR-010): `products.status =
'active'`, variantes `is_active = true` y categorías asociadas a productos visibles.

```ts
// features/catalog/types/catalog.types.ts

export type ProductStatus = 'draft' | 'active' | 'archived'

export interface CategoryView {
  id: string
  name: string
  slug: string
  parentId: string | null
}

export interface ProductListItem {
  id: string
  name: string
  slug: string
  brand: string | null
  productType: string | null
  priceFrom: number                        // min(price) de variantes activas
  primaryImage: { storagePath: string; altText: string | null } | null
  categories: Pick<CategoryView, 'id' | 'name' | 'slug'>[]
}

export interface ProductVariantView {
  id: string
  sku: string
  price: number
  compareAtPrice: number | null
  isActive: boolean
  size: { id: string; name: string } | null
  color: { id: string; name: string; hexCode: string | null } | null
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  description: string | null
  brand: string | null
  productType: string | null
  images: { id: string; storagePath: string; altText: string | null; sortOrder: number }[]
  variants: ProductVariantView[]
  categories: Pick<CategoryView, 'id' | 'name' | 'slug'>[]
}
```

### Queries públicas

```ts
// features/catalog/queries/list-products.ts
export interface ListProductsInput {
  categorySlug?: string
  search?: string
  page?: number
  pageSize?: number
}

export function listProducts(input?: ListProductsInput): Promise<ProductListItem[]>

// features/catalog/queries/get-product.ts
export function getProductBySlug(slug: string): Promise<ProductDetail | null>

// features/catalog/queries/list-categories.ts
export function listCategories(): Promise<CategoryView[]>

// features/catalog/queries/list-taxonomies.ts
export function listSizes(): Promise<{ id: string; name: string; sortOrder: number }[]>
export function listColors(): Promise<{ id: string; name: string; hexCode: string | null; sortOrder: number }[]>
```

Reglas de contrato:

- `listProducts` filtra por `status = 'active'`, ordena de forma determinista y devuelve `priceFrom`
  calculado a partir de variantes activas; aplica paginación simple.
- `getProductBySlug` devuelve `null` si el producto no existe o no está `active` (FR-010).
- `ProductDetail.variants` incluye solo variantes `is_active = true` para la vista pública; la
  combinación talle/color identifica como máximo una variante (FR-003/FR-004).
- Las imágenes se ordenan por `sort_order` ascendente; la primera es la principal (FR-006).

### Mutaciones de administración (P2)

Server Functions en `features/catalog/actions/admin-product-actions.ts`, con validación Zod y
verificación de autorización server-side antes de tocar la base:

```ts
export interface UpsertProductInput { /* name, slug, description, brand, productType, status, categories, variants, images */ }

export function createProduct(input: UpsertProductInput): Promise<{ id: string }>
export function updateProduct(productId: string, input: UpsertProductInput): Promise<void>
export function publishProduct(productId: string): Promise<void>   // status → 'active' (FR-001, SC-004)
export function archiveProduct(productId: string): Promise<void>   // status → 'archived' (FR-008)
export function reorderProductImages(productId: string, imageIds: string[]): Promise<void> // FR-006
```

Reglas de contrato de administración:

- No se permite publicar un producto sin al menos una variante vendible (SC-003).
- Un SKU no puede reutilizarse; la violación de unicidad se traduce a un error de validación
  distinguible (edge case).
- Tras publicar/archivar se revalidan las rutas afectadas (listado, detalle, categoría) de forma
  selectiva, no global (`ARCHITECTURE.md` §13).

---

## 7. Fases de implementación

### Fase 0 — Setup

- Instalar y configurar Vitest y Playwright (scripts en `package.json`).
- Configurar `remotePatterns` de Supabase Storage en `next.config.mjs`.
- Verificar variables de entorno en `.env.example` y `lib/env.ts`.
- Inicializar Supabase local/CLI y generar `types/database.types.ts`.

### Fase 1 — Migraciones y RLS

- `20260920000001_catalog.sql`: crear `sizes`, `colors`, `categories`, `products`,
  `product_variants`, `product_categories`, `product_images` con constraints e índices.
- En la misma migración, habilitar RLS en todas las tablas, crear políticas explícitas por
  operación y grants; restringir `cost_price` a nivel de column grant.
- Migración de Storage: políticas del bucket `product-images` (lectura pública de objetos
  publicados; escritura server-side autorizada).
- `seed.sql`: talles, colores, categorías y productos de ejemplo (draft/active/archived).

### Fase 2 — Dominio y queries

- Tipos en `catalog.types.ts` y schemas Zod en `catalog.schema.ts`.
- Implementar queries públicas y mapeos DB → view models.
- `catalog-service.ts` compone queries para páginas.

### Fase 3 — UI Server / Client

- Rutas de listado, detalle y categoría en `app/(store)/`.
- Componentes server (`product-card`, `product-grid`, `product-gallery`, `category-nav`).
- `variant-selector.tsx` como Client Component: selección talle/color, accesible por teclado.
- Integrar `next/image` con el bucket `product-images`.
- Configurar cache/revalidación del catálogo público.

### Fase 4 — Administración (P2)

- Server Functions con validación y autorización.
- Página `app/admin/productos/page.tsx` y formularios mínimos.
- Revalidación selectiva tras mutaciones.

### Fase 5 — Tests

- Unit (Vitest): schemas, mappers, cálculo de `priceFrom`.
- Integración/RLS: queries y políticas (permitido/denegado) en entorno aislado.
- E2E (Playwright): listado → detalle (SC-001) y selección de variante (US2).

### Fase 6 — Verificación

- `lint`, `typecheck`, `test`, `build`.
- Validación de migración desde base limpia y de RLS.
- Revisión de accesibilidad y de que no haya secretos expuestos.

---

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| RLS mal configurada expone productos `draft`/`archived` | Alto | Políticas explícitas + grants; tests de integración/RLS con casos permitidos y denegados (FR-010). |
| Consultas N+1 en listado/detalle | Rendimiento | `select` anidado en una consulta por vista; índices en FKs y `slug`/`status`; paginación. |
| Orden de imágenes no determinista | UX / FR-006 | `sort_order` + desempate estable por `id`; test unitario del mapeo. |
| Colisión de SKU | Integridad (FR-002) | Constraint `unique(sku)` en DB; error de validación distinguible en administración. |
| Producto `active` sin variante vendible | SC-003 | Validación server-side al publicar; consulta pública filtra variantes activas. |
| Cambio de slug rompe enlaces | UX | Tratar `slug` como estable; único en DB; no regenerarlo automáticamente al renombrar. |
| Drift entre esquema y tipos TS | Build | Generar `database.types.ts` desde el esquema y regenerarlo en cada migración. |
| Cache sirve catálogo obsoleto tras publicar/archivar | SC-004 | Revalidación selectiva de rutas afectadas tras cada mutación; no invalidación global. |
| Archivar elimina referencias históricas | Alto (FR-008) | Soft delete/estado `archived`; `order_items` conserva snapshot (módulo 004). |
| Secret key filtrada al cliente | Seguridad | `server-only` en `admin.ts`; lecturas públicas solo con cliente SSR publicable. |
| Bucket `product-images` con acceso indebido | Seguridad | Políticas de Storage explícitas en la migración; validar MIME/tamaño/path en subidas. |

---

## 9. Out of scope

- **Inventario/stock transaccional**: cantidades, reservas y movimientos (`006-inventory`). El
  catálogo expone `is_active` de variante, no disponibilidad.
- **Checkout, pedidos y snapshots históricos** (`004-checkout-orders`).
- **Pagos y webhooks** (`005-payments`).
- **Envíos** (`008-shipping`).
- **Diseños y personalización** (`007-designs`).
- **Promociones y cupones** (`009-promotions`).
- **Clientes, perfiles y direcciones** (`002-customers`).
- Reviews, wishlists, tags, colecciones, multi-moneda y analytics avanzada (`ARCHITECTURE.md` §29).
- Una API REST pública completa: no se exponen Route Handlers para el catálogo; la lectura es
  server-side y las mutaciones internas usan Server Functions (`ARCHITECTURE.md` §14).
- Subida/edición de imágenes en la UI de administración más allá de asociar `storage_path` y
  reordenar; la gestión fina de archivos queda acotada a lo que la spec requiere (FR-006).
