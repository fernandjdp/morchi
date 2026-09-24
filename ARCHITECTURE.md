# Architecture — Tienda de Ropa y Diseño de Remeras

**Estado:** Proposed  
**Fecha:** 2026-09-20  
**Ámbito:** Arquitectura base del sistema completo  
**Relacionada con:** `specs/001-catalog` a `specs/009-promotions`

---

## 1. Propósito

Este documento define las decisiones arquitectónicas persistentes del ecommerce de ropa y diseño de remeras.

Su objetivo es establecer una base común para que las especificaciones funcionales, los `plan.md` y los `tasks.md` de cada módulo no tomen decisiones técnicas incompatibles entre sí.

El documento no reemplaza las specs funcionales. En particular:

- Las `spec.md` describen **qué** debe hacer el sistema y **por qué**.
- Este documento describe las restricciones y decisiones arquitectónicas que deben respetar esas funcionalidades.
- Cada `plan.md` de Spec Kit deberá tomar de aquí únicamente las decisiones que afecten a su feature.

Spec Kit ubica las decisiones de stack, almacenamiento, testing, plataforma, estructura del proyecto y arquitectura dentro del proceso de planificación; por eso este archivo funciona como referencia de arquitectura a nivel proyecto y no como una feature más. 

---

## 2. Principios arquitectónicos

### 2.1. Vercel-first

La aplicación web, el frontend, el backend de aplicación, los endpoints HTTP y el despliegue principal estarán centrados en Vercel.

Vercel será la plataforma de ejecución y entrega de la aplicación Next.js.

### 2.2. Supabase como backend de datos administrado

Supabase será el sistema de referencia para:

- PostgreSQL.
- Auth.
- Storage.
- RLS.
- Migraciones del esquema.

No se utilizará una segunda base de datos para el dominio principal del ecommerce.

### 2.3. Seguridad en profundidad

La autorización no dependerá únicamente del frontend.

Las reglas deberán existir en dos niveles:

1. Autorización de aplicación en el servidor.
2. RLS/permissions en Supabase cuando el dato pueda ser expuesto mediante las APIs de Supabase.

Las tablas del esquema expuesto deberán tener RLS habilitado y políticas explícitas para las operaciones permitidas. Supabase recomienda este enfoque y aclara que activar políticas no sustituye la configuración de grants. 

### 2.4. Server by default

Next.js App Router utilizará Server Components como comportamiento predeterminado.

Client Components se reservarán para interfaces que necesiten interactividad en el navegador, por ejemplo:

- editor de diseños,
- filtros interactivos,
- carrito dinámico,
- formularios con estado local,
- previews de personalización.

El App Router actual de Next.js utiliza Server Components, Suspense y Server Functions como parte central del modelo de aplicación. 

### 2.5. El dominio manda

Las decisiones del dominio no deben quedar dispersas por las páginas de Next.js.

La lógica de negocio deberá vivir principalmente en servicios/use-cases y funciones de dominio reutilizables, no en componentes React.

### 2.6. Historial inmutable de operaciones comerciales

Pedidos, líneas de pedido, precios, direcciones de envío y personalizaciones deberán conservar un snapshot de la información necesaria para reconstruir exactamente la compra realizada.

Nunca se dependerá exclusivamente de la versión actual de `products` para representar un pedido histórico.

### 2.7. Integraciones externas detrás de límites explícitos

Mercado Pago, operadores logísticos y otros proveedores externos se accederán mediante módulos de integración específicos.

La lógica del dominio no deberá depender directamente de SDKs de proveedores cuando pueda evitarse.

---

## 3. Stack tecnológico

### 3.1. Aplicación

| Capa | Tecnología | Decisión |
|---|---|---|
| Framework | Next.js | App Router |
| Lenguaje | TypeScript | obligatorio |
| UI | React | Server Components por defecto |
| Styling | Tailwind CSS | utilidades y diseño responsive |
| Componentes | shadcn/ui o componentes propios | reutilizables y accesibles |
| Validación | Zod | validación de inputs y contratos |
| Testing unitario | Vitest | lógica de dominio y servicios |
| Testing E2E | Playwright | journeys críticos |
| Deploy | Vercel | producción, previews y CI/CD |

No se fijará una versión menor concreta en este documento. La versión de Next.js, React, TypeScript y dependencias se fijará mediante el `package.json` y lockfile del proyecto.

### 3.2. Backend de aplicación

Next.js será también el backend de aplicación.

Se utilizarán:

- Server Components para lectura de datos y renderizado.
- Server Functions/Server Actions para mutaciones originadas desde la UI.
- Route Handlers para webhooks, callbacks e interfaces HTTP que necesiten un endpoint explícito.

Las Server Functions son invocables mediante requests de red; por ello cada función debe verificar autenticación y autorización internamente y no confiar en que solamente la UI pueda invocarla. 

### 3.3. Datos

| Necesidad | Tecnología |
|---|---|
| Base de datos | Supabase PostgreSQL |
| Auth | Supabase Auth |
| ORM/Data access | Supabase JS + capa de servicios/repositorios |
| Archivos | Supabase Storage |
| Autorización | Supabase RLS + autorización de aplicación |
| Migraciones | Supabase CLI / SQL migrations |

Para Next.js con sesiones SSR, Supabase documenta `@supabase/ssr` como el paquete orientado al uso de sesiones mediante cookies. 

---

## 4. Topología lógica

```text
                                      ┌───────────────────────┐
                                      │       Usuario         │
                                      │ Browser / Mobile Web  │
                                      └───────────┬───────────┘
                                                  │
                                             HTTPS / CDN
                                                  │
                                      ┌───────────▼───────────┐
                                      │        Vercel         │
                                      │                       │
                                      │ Next.js App Router    │
                                      │ Server Components     │
                                      │ Server Functions      │
                                      │ Route Handlers        │
                                      └───────┬───────┬───────┘
                                              │       │
                              user-scoped     │       │ server-only
                              Supabase SSR    │       │ secret operations
                                              │       │
                              ┌───────────────┘       └───────────────┐
                              ▼                                       ▼
                   ┌─────────────────────┐                 ┌─────────────────────┐
                   │ Supabase Auth       │                 │ Supabase APIs       │
                   │ Cookie session     │                 │ + secret key        │
                   └──────────┬──────────┘                 └──────────┬──────────┘
                              │                                       │
                              └────────────────┬──────────────────────┘
                                               ▼
                                  ┌────────────────────────┐
                                  │ Supabase PostgreSQL    │
                                  │                        │
                                  │ RLS + constraints      │
                                  │ triggers/functions     │
                                  └────────────────────────┘
                                               │
                                  ┌────────────┴────────────┐
                                  ▼                         ▼
                        ┌─────────────────┐       ┌─────────────────┐
                        │ Supabase        │       │ External APIs   │
                        │ Storage         │       │ Mercado Pago    │
                        │ images/assets   │       │ Shipping/etc.   │
                        └─────────────────┘       └─────────────────┘
```

---

## 5. Responsabilidad de cada plataforma

### Vercel

Vercel será responsable de:

- hosting y deployment de Next.js,
- CDN/entrega web,
- preview deployments,
- ejecución de Server Functions,
- ejecución de Route Handlers,
- integración con Git y CI/CD,
- variables de entorno por entorno,
- observabilidad disponible en Vercel.

### Supabase

Supabase será responsable de:

- persistencia del dominio,
- autenticación,
- autorización de filas mediante RLS,
- almacenamiento de imágenes y archivos,
- SQL migrations,
- funciones y triggers de base de datos cuando aporten una garantía transaccional útil.

Supabase recomienda almacenar archivos fuera de PostgreSQL y administrar el acceso a través de Storage/RLS. 

### Mercado Pago

Mercado Pago será responsable únicamente del procesamiento del pago.

El estado local del pedido y el inventario seguirán siendo responsabilidad del sistema.

El cambio de estado definitivo deberá confirmarse mediante el mecanismo server-to-server correspondiente (webhook/notification), no únicamente mediante el redirect del navegador.

---

## 6. Arquitectura de la aplicación Next.js

La aplicación seguirá una arquitectura **modular por dominio**, combinada con las convenciones del App Router.

```text
src/
├── app/
│   ├── (store)/
│   │   ├── page.tsx
│   │   ├── products/
│   │   ├── categories/
│   │   ├── cart/
│   │   └── checkout/
│   │
│   ├── account/
│   │   ├── profile/
│   │   ├── orders/
│   │   └── addresses/
│   │
│   ├── admin/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── orders/
│   │   └── designs/
│   │
│   └── api/
│       └── webhooks/
│           └── mercadopago/
│               └── route.ts
│
├── components/
│   ├── ui/
│   └── shared/
│
├── features/
│   ├── catalog/
│   ├── customers/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── payments/
│   ├── inventory/
│   ├── designs/
│   ├── shipping/
│   └── promotions/
│
├── lib/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── auth/
│   ├── validations/
│   ├── errors/
│   ├── pricing/
│   └── observability/
│
└── types/
    └── database.types.ts

supabase/
├── migrations/
├── seed.sql
└── tests/

tests/
├── unit/
├── integration/
└── e2e/
```

### Regla principal

`app/` expresa rutas y composición de páginas.

`features/` contiene capacidades de negocio.

`lib/` contiene infraestructura transversal.

No se debe convertir `app/` en el lugar donde vive toda la lógica de negocio.

---

## 7. Patrón de acceso a datos

### 7.1. Lecturas públicas

Ejemplo: listado de productos publicados.

```text
Server Component
      ↓
Catalog service
      ↓
Supabase SSR client
      ↓
PostgREST / PostgreSQL
```

Las lecturas públicas deberán devolver únicamente los campos necesarios para la interfaz.

### 7.2. Lecturas autenticadas

Ejemplo: historial de pedidos.

```text
Server Component
      ↓
Order query/service
      ↓
Supabase SSR client
      ↓
Auth session
      ↓
RLS
      ↓
orders
```

La consulta deberá quedar limitada por identidad mediante RLS y, cuando corresponda, una comprobación adicional a nivel aplicación.

### 7.3. Mutaciones

Ejemplo: agregar una variante al carrito.

```text
Client Component / Form
          ↓
Server Function
          ↓
Validation (Zod)
          ↓
Authorization
          ↓
Domain service
          ↓
Supabase
```

Las mutaciones críticas no deberán depender de que el cliente haya enviado datos confiables.

Se volverán a calcular server-side:

- precio,
- descuentos,
- stock,
- subtotal,
- envío,
- total,
- identidad del usuario.

### 7.4. Operaciones privilegiadas

Las operaciones administrativas o que necesiten bypass de RLS utilizarán un cliente server-only con la **secret key** de Supabase.

La secret key nunca debe llegar al navegador. Supabase indica que las publishable keys son aptas para código que se entrega al cliente, mientras que las secret keys son de uso exclusivo de componentes bajo control del servidor y bypass de RLS. 

---

## 8. Auth y sesiones

Supabase Auth será la fuente de identidad.

La tabla de dominio `profiles` referenciará al usuario de `auth.users`.

### Flujo

```text
Browser
   ↓
Supabase Auth
   ↓
cookie-based session
   ↓
Next.js SSR
   ↓
Supabase SSR client
```

Para Next.js SSR se utilizará `@supabase/ssr` y sesiones basadas en cookies, siguiendo la integración oficial de Supabase. 

### Reglas

- Nunca almacenar access tokens manualmente en `localStorage` como estrategia principal de sesión.
- Nunca confiar en un `user_id` enviado por el navegador.
- Obtener la identidad desde la sesión verificada.
- Cualquier Server Function que modifique datos deberá verificar autenticación/autorización.
- El rol administrativo deberá comprobarse server-side.

---

## 9. Autorización y RLS

Se contemplan dos tipos principales de acceso:

### Visitante

```text
anon
├── catálogo publicado: lectura
├── categorías publicadas: lectura
└── imágenes públicas: lectura
```

### Usuario autenticado

```text
authenticated
├── profile: propio
├── addresses: propias
├── carts: propios
├── designs: propios
├── orders: propios
└── order_items: de sus órdenes
```

### Administrador

El administrador tendrá permisos adicionales, pero la autorización de administración deberá estar implementada explícitamente y no depender únicamente de ocultar rutas en la UI.

Para cada tabla expuesta deberán existir políticas para las operaciones realmente soportadas. Supabase recomienda comprobar tanto grants como policies y probar explícitamente los casos permitidos y denegados. 

---

## 10. Modelo de datos de alto nivel

```text
profiles
   │
   ├── addresses
   ├── carts ── cart_items ── product_variants
   ├── designs ── design_assets
   └── orders
          │
          ├── order_items ── products
          │                  └── product_variants
          │
          ├── order_addresses
          ├── payments
          └── shipments

products
   ├── product_variants ── sizes
   │                    └── colors
   ├── product_images
   ├── categories
   └── product_designs ── designs

product_variants
   ├── inventory_levels
   └── inventory_movements

coupons
   └── coupon_redemptions ── orders
```

El modelo completo se detalla en las specs de los módulos correspondientes.

---

## 11. Reglas de consistencia del dominio

### 11.1. Precios

Los precios utilizados para calcular una orden se obtendrán server-side.

`order_items.unit_price` será el snapshot del precio cobrado.

No se deberá recalcular un pedido histórico leyendo `products` o `product_variants` actuales.

### 11.2. Inventario

El inventario no será decrementado por una simple mutación desde el cliente.

Las operaciones críticas de stock deberán ejecutarse de manera atómica para evitar overselling.

La arquitectura prevista es:

```text
Checkout
   ↓
validate stock
   ↓
reserve/decrement atomically
   ↓
create order
   ↓
payment
```

La estrategia exacta de reserva vs. descuento definitivo se decidirá en el `plan.md` del módulo de checkout/inventory, pero debe conservar atomicidad.

### 11.3. Pedido y pago

El estado del pedido, el estado del pago y el estado del fulfillment son conceptos diferentes y deberán mantenerse separados.

```text
order.status
payment.status
shipment/fulfillment.status
```

### 11.4. Snapshots

Una orden deberá conservar snapshots suficientes de:

- nombre del producto,
- SKU,
- variante,
- precio,
- dirección,
- personalización,
- moneda.

### 11.5. Dinero

Los importes comerciales se almacenarán como `numeric`, no como `float`.

El pedido tendrá una moneda explícita, inicialmente `ARS`.

---

## 12. Diseños y archivos

Los archivos binarios de imágenes y diseños se almacenarán en Supabase Storage.

PostgreSQL conservará únicamente metadatos y referencias al storage.

La estructura lógica recomendada es:

```text
Storage buckets
├── product-images
│   └── {product-id}/...
│
└── design-assets
    └── {user-id}/{design-id}/...
```

Cada bucket tendrá políticas propias y no se modificará directamente el esquema interno `storage`; las operaciones de Storage deberán pasar por la API correspondiente. 

Los uploads de usuario deberán validar como mínimo:

- MIME type permitido,
- tamaño máximo,
- extensión,
- propietario,
- bucket/destination path.

El nombre final del archivo no deberá provenir ciegamente de un nombre enviado por el usuario.

---

## 13. Cache y revalidación

Next.js será responsable de las estrategias de cache del contenido de aplicación.

### Público

El catálogo publicado y contenido que cambia poco podrá utilizar caching/revalidation.

### Dinámico

No deberá cachearse de forma compartida información específica del usuario como:

- carrito,
- pedidos,
- direcciones,
- datos privados del diseño,
- información de pago.

### Después de una mutación

Las mutaciones deberán invalidar/revalidar únicamente las partes afectadas.

Ejemplo:

```text
Admin actualiza producto
       ↓
DB mutation
       ↓
revalidate product
       ↓
revalidate category/listing si corresponde
```

No se utilizará invalidación global como mecanismo por defecto.

---

## 14. API boundaries

No se construirá una API REST completa por adelantado.

Se expondrán endpoints únicamente donde exista una razón clara.

### Route Handlers previstos

```text
POST /api/webhooks/mercadopago
```

y, cuando exista necesidad real:

```text
GET/POST /api/...
```

Los Server Functions serán preferidos para mutaciones internas originadas por la UI cuando no exista una necesidad de contrato HTTP público independiente.

### Webhooks

Los webhooks deberán:

1. validar autenticidad/firma cuando el proveedor lo soporte,
2. validar el payload,
3. resolver el recurso local correspondiente,
4. ejecutar la operación de forma idempotente,
5. registrar resultado/error,
6. responder con un status HTTP apropiado.

Un webhook duplicado no deberá generar dos capturas, dos descuentos de stock ni dos órdenes.

---

## 15. Integración con Mercado Pago

La integración quedará encapsulada en:

```text
features/payments/
```

y/o

```text
lib/integrations/mercadopago/
```

El dominio dependerá de una interfaz conceptual, por ejemplo:

```ts
interface PaymentProvider {
  createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult>
  getPayment(paymentId: string): Promise<PaymentResult>
}
```

La implementación de Mercado Pago será una adaptación de esa interfaz.

Esto permite cambiar de proveedor posteriormente sin contaminar `orders` y `checkout` con clases o tipos específicos del proveedor.

Los identificadores externos, como `provider_payment_id` o `provider_preference_id`, se conservarán como metadata de integración.

---

## 16. Separación entre dominio e infraestructura

Una feature debería seguir aproximadamente este patrón:

```text
features/orders/
├── actions/
│   ├── create-order.ts
│   └── cancel-order.ts
├── queries/
│   ├── get-order.ts
│   └── list-orders.ts
├── services/
│   └── order-service.ts
├── schemas/
│   └── order.schema.ts
├── types/
│   └── order.types.ts
└── components/
    └── ...
```

### Dependencias permitidas

```text
UI
 ↓
Actions / Queries
 ↓
Services / Domain
 ↓
Infrastructure adapters
 ↓
Supabase / external APIs
```

### Dependencias no deseadas

```text
React component
   ↓
Mercado Pago SDK
```

```text
React component
   ↓
secret Supabase key
```

```text
Product page
   ↓
SQL business rule específica de checkout
```

---

## 17. Transacciones

Cuando una operación requiera modificar varias entidades relacionadas, deberá considerarse una transacción o una función de base de datos que proporcione atomicidad.

Ejemplos:

- crear pedido + líneas + snapshot de dirección,
- reservar stock para varias variantes,
- confirmar pago + cambiar estado de pedido + aplicar movimiento de inventario,
- reembolso + devolución de stock.

La decisión entre resolver la transacción en una función PostgreSQL o en la capa de aplicación deberá tomarse según el caso, priorizando:

1. atomicidad,
2. consistencia,
3. simplicidad,
4. capacidad de test.

---

## 18. Idempotencia

Todas las operaciones potencialmente repetibles deberán diseñarse para ser idempotentes cuando corresponda.

Especialmente:

- webhooks de pago,
- creación de órdenes desde reintentos,
- movimientos de inventario vinculados a un evento externo,
- generación de etiquetas de envío.

Los identificadores de proveedor y referencias de negocio deberán poder utilizarse para detectar duplicados.

---

## 19. Estados y eventos

Los estados deben representar hechos del dominio, no solamente estados visuales de la UI.

Cuando una transición sea relevante para auditoría o integración externa, se deberá considerar registrar un evento o movimiento.

Ejemplos:

```text
payment approved
order confirmed
inventory reserved
shipment shipped
refund completed
```

No es obligatorio crear un event store completo para el MVP.

Un historial simple por entidad o tablas de movimientos será suficiente inicialmente.

---

## 20. Observabilidad

La aplicación deberá facilitar la correlación de una operación de punta a punta.

Todo flujo crítico debería poder relacionarse mediante identificadores como:

```text
request_id
order_id
payment_id
provider_payment_id
shipment_id
```

No deberán registrarse:

- contraseñas,
- tokens de sesión,
- secret keys,
- datos sensibles de pago,
- información innecesaria de tarjetas.

Los errores deberán diferenciar:

- error de validación,
- error de autorización,
- error de dominio,
- error de infraestructura,
- error de proveedor externo.

---

## 21. Testing

### Unit

Se probarán principalmente:

- reglas de precio,
- descuentos,
- disponibilidad,
- transiciones de estado,
- validaciones,
- cálculos de totales,
- reglas de personalización.

### Integration

Se probarán:

- servicios contra Supabase,
- RLS,
- transacciones,
- autenticación,
- storage policies,
- webhooks.

Supabase recomienda crear pruebas específicas para las políticas RLS y ejecutarlas con `supabase test db`. 

### E2E

Los journeys mínimos serán:

```text
browse catalog
  → select variant
  → add to cart
  → checkout
  → payment
  → order confirmation
```

y:

```text
login
  → create design
  → customize product
  → add to cart
  → checkout
```

También se cubrirán casos negativos críticos, como stock insuficiente y pago rechazado.

---

## 22. Migraciones de base de datos

El schema de producción deberá evolucionar mediante migraciones versionadas.

```text
supabase/migrations/
├── 0001_profiles.sql
├── 0002_catalog.sql
├── 0003_cart.sql
├── 0004_orders.sql
├── ...
```

No se considerará el SQL ejecutado manualmente en el dashboard como fuente de verdad.

Los cambios del esquema deberán:

1. vivir en una migración,
2. poder ejecutarse sobre una base limpia,
3. poder reproducirse en CI/preview cuando corresponda,
4. incluir índices, constraints, grants y RLS relacionados.

---

## 23. Variables de entorno

Ejemplo conceptual:

```text
# Client-safe
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# Server-only
SUPABASE_SECRET_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
```

Reglas:

- Todo secreto debe carecer de prefijo `NEXT_PUBLIC_`.
- Nunca commitear secretos.
- Nunca imprimir secretos en logs.
- Diferenciar variables de desarrollo, preview y producción.
- Vercel será la fuente de configuración para los entornos desplegados.

Las claves publishable de Supabase pueden utilizarse en código que llega al cliente, siempre que RLS limite el acceso; las secret keys deben permanecer exclusivamente en código controlado por el servidor. 

---

## 24. Entornos

Se contemplan inicialmente:

```text
local
preview
production
```

### Local

- Next.js local.
- Supabase local mediante Supabase CLI cuando resulte conveniente.
- Mercado Pago sandbox/test.

### Preview

- Vercel Preview Deployment.
- Proyecto/base de datos de staging o branching apropiado.
- Credenciales de prueba.

### Production

- Vercel Production.
- Supabase Production.
- Mercado Pago producción.

No deberán mezclarse credenciales de producción y preview.

---

## 25. Deployment

El flujo previsto es:

```text
Git push
   ↓
Vercel build
   ↓
Lint
   ↓
Typecheck
   ↓
Unit tests
   ↓
Build
   ↓
Preview / Production
```

Las migraciones de Supabase deberán formar parte de un proceso controlado independiente del build de frontend, evitando que un deploy parcialmente exitoso deje el schema en un estado inesperado.

---

## 26. Rendimiento

Objetivos iniciales de arquitectura:

- priorizar Server Components para reducir JavaScript enviado al cliente,
- minimizar Client Components grandes,
- usar imágenes optimizadas,
- cachear catálogo público cuando sea seguro,
- paginar back-office e historiales,
- indexar las consultas frecuentes de PostgreSQL,
- evitar N+1 queries,
- mantener las operaciones críticas de checkout cortas y transaccionales.

No se fijan SLO estrictos de infraestructura en este documento; esos objetivos deberán definirse cuando las specs establezcan volumen esperado y requisitos comerciales.

---

## 27. Accesibilidad y UX

La arquitectura UI deberá respetar:

- HTML semántico,
- navegación por teclado,
- labels y mensajes de error accesibles,
- foco visible,
- contraste adecuado,
- responsive desde mobile,
- estados explícitos de loading/error/success.

Las validaciones server-side siempre serán la autoridad; la validación de cliente es solamente una mejora de UX.

---

## 28. Decisiones explícitas y anti-patrones

### No hacer

```text
❌ secret Supabase key en Client Components
❌ confiar en price enviado por el browser
❌ confiar en stock enviado por el browser
❌ considerar un redirect de Mercado Pago como confirmación definitiva
❌ guardar imágenes grandes dentro de PostgreSQL
❌ modificar stock directamente desde múltiples clientes sin atomicidad
❌ usar orders.total como única fuente sin order_items
❌ reconstruir pedidos históricos desde el producto actual
❌ poner toda la lógica de negocio dentro de page.tsx
```

### Hacer

```text
✅ Server Functions para mutaciones de UI
✅ Route Handlers para webhooks/integraciones HTTP
✅ RLS para datos expuestos por Supabase
✅ checks de autorización server-side
✅ snapshots para información histórica
✅ Storage para archivos
✅ migraciones versionadas
✅ operaciones críticas idempotentes
✅ transacciones para invariantes de dominio
✅ adaptadores para proveedores externos
```

---

## 29. Evolución futura

La arquitectura deberá permitir añadir sin reescritura estructural:

- múltiples métodos de pago,
- múltiples transportistas,
- múltiples depósitos/ubicaciones de inventario,
- marketplace/social commerce,
- programas de fidelización,
- reviews,
- wishlists,
- gift cards,
- múltiples monedas,
- analytics más avanzada.

No se implementarán estas capacidades por adelantado salvo que una spec las requiera.

---

## 30. Integración con Spec Kit

Este archivo es la referencia arquitectónica del proyecto.

Cuando se ejecute `/speckit.plan` para una feature:

1. Leer `ARCHITECTURE.md`.
2. Extraer solamente las decisiones relevantes para esa feature.
3. Reflejarlas en `plan.md`.
4. Resolver cualquier conflicto con la constitución del proyecto.
5. Generar `data-model.md`, `contracts/`, `quickstart.md` y `tasks.md` cuando correspondan.

La implementación debe considerar `plan.md` como el contrato técnico de la feature concreta, mientras que `ARCHITECTURE.md` conserva las decisiones globales.

Spec Kit indica que `/plan` utiliza `plan.md` para capturar el stack, arquitectura, estructura del proyecto, modelo de datos y restricciones, y que `/implement` debe leer ese plan antes de implementar. 

---

## 31. ADRs futuros

Cuando una decisión arquitectónica importante no pueda resolverse únicamente actualizando este documento, se deberá crear un ADR.

Estructura sugerida:

```text
/docs/adr/
├── 001-nextjs-fullstack.md
├── 002-supabase-as-system-of-record.md
├── 003-payment-provider-abstraction.md
└── ...
```

Los ADRs deberán incluir como mínimo:

- Contexto.
- Decisión.
- Alternativas consideradas.
- Consecuencias.
- Estado.

---

## 32. Referencias técnicas

- GitHub Spec Kit — Spec Template: https://github.com/github/spec-kit/blob/main/templates/spec-template.md
- GitHub Spec Kit — Plan Template: https://github.com/github/spec-kit/blob/main/templates/plan-template.md
- GitHub Spec Kit — Quickstart: https://github.com/github/spec-kit/blob/main/docs/quickstart.md
- Next.js App Router: https://nextjs.org/docs/app
- Next.js Server Functions / Server Actions: https://nextjs.org/docs/app/getting-started/mutating-data
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase API Keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage: https://supabase.com/docs/guides/storage

---

## 33. Decision summary

```text
Frontend + Backend
    → Next.js App Router on Vercel

Identity
    → Supabase Auth

Database
    → Supabase PostgreSQL

Authorization
    → Application authorization + PostgreSQL RLS

Files
    → Supabase Storage

Business mutations
    → Next.js Server Functions

External HTTP integrations/webhooks
    → Next.js Route Handlers

Payments
    → Mercado Pago adapter

Migrations
    → Supabase CLI / SQL migrations

Testing
    → Vitest + integration tests + Playwright

Architecture style
    → Modular monolith / domain-oriented Next.js application
```
