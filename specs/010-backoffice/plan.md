# Plan Técnico: Backoffice comercial y operativo (010-backoffice)

Spec: [`spec.md`](./spec.md)
Estado: Draft

## Resumen

Agregar un área `/admin` dentro del monolito Next.js para dashboard, catálogo, inventario y pedidos. Se reutilizan los esquemas y responsabilidades de `001-catalog`, `004-checkout-orders` y `006-inventory`; esta feature es dueña de la experiencia administrativa y del historial de actividad, no de reglas de pagos ni de checkout.

## Arquitectura y seguridad

- Server Components para páginas y queries. Client Components acotados a filtros, navegación móvil, formularios y controles interactivos.
- `lib/supabase/server.ts` valida sesión. La autorización verifica `user.app_metadata.role === 'admin'`; nunca `user_metadata`.
- Cliente con clave secreta solo después del check administrativo, en módulos `server-only`. No se expone acceso a datos administrativos vía cliente.
- Toda Server Action repite el check de sesión/rol, valida con Zod y usa servicios de dominio. No se asume que el layout protege invocaciones directas.
- Migraciones mantienen RLS y grants explícitos. El servicio privilegiado se usa solo en servidor tras autorización. Vistas agregadas internas no se conceden al rol público.
- Sin caché compartida para datos del backoffice. Los filtros de período, búsqueda y paginación se resuelven desde `searchParams`.

## Modelo/consultas

- El esquema actual provee productos, variantes, categorías, inventario, pedidos y snapshots.
- Nueva tabla `admin_order_activity` audita transiciones de fulfillment, con actor, estado anterior/nuevo, nota y fecha; RLS deniega acceso directo de anon/authenticated y grants limitados a `service_role`.
- Métricas monetarias agregan `orders.total` (importe final persistido, con descuentos ya aplicados) para `payment_status='approved'`, dentro del período y excluyendo cancelaciones/reembolsos. Se etiqueta como venta neta cobrada, no margen/ganancia contable.
- Tendencias agregan unidades por snapshot `order_items.product_name` y `quantity`, asociadas a pedidos aprobados; no dependen de nombres actuales del catálogo.
- Ajustes de inventario se implementan mediante función SQL transaccional que actualiza `inventory_levels` y agrega un movimiento; requiere rol autorizado en capa servidor.
- Productos se guardan mediante operaciones validadas; publicar exige variante activa.

## Rutas previstas

- `/admin` Dashboard.
- `/admin/productos` listado y estado del catálogo.
- `/admin/productos/nuevo` alta de producto y variantes.
- `/admin/pedidos` lista paginada y filtrable.
- `/admin/pedidos/[id]` detalle y fulfillment.
- `/admin/inventario` existencias y ajustes auditables.

## Estado implementado y límites de primera entrega

- El dashboard consulta pedidos aprobados, líneas con snapshot e inventario real. Períodos: 7, 30 y 90 días; comparación con el período previo del mismo largo.
- Las consultas operativas están limitadas a 5.000 pedidos en dashboard y 100 filas por página/listado inicial. Se requiere paginación de cursor o agregaciones SQL para catálogos/volúmenes grandes.
- El primer formulario de producto crea un producto borrador con variante, atributos de talle/color y stock inicial. Luego permite agregar variantes, editar nombre/descripción/estado y subir imágenes públicas hasta 5 MB.
- La categoría primaria puede asignarse por nombre en edición/alta; la administración completa de jerarquías y categorías sigue fuera del backoffice inicial. La publicación solo comprueba que exista una variante activa.
- El cambio de fulfillment usa compare-and-set y registra auditoría con compensación ante fallo; una RPC transaccional es recomendable antes de operación de alto volumen.

## Constitution Check

- I: feature especificada y dependencias acíclicas con catálogo, inventario, pedidos y pagos.
- II: App Router server-first, Server Actions autorizadas individualmente.
- III: migración versionada, RLS/grants explícitos, cambios de stock atómicos.
- IV: claves server-only, rol tomado de app_metadata no editable por usuarios.
- V: planes de verificación deben cubrir autorización, agregados y atomicidad (se implementarán según infraestructura de test disponible).
- VI: transiciones idempotentes/seguras ante reintentos; no duplica movimientos.
- VII: métricas con estados vacíos, formato local y UI accesible.

## Riesgos y limitaciones

- `order_items` no conserva costo histórico; por ello el panel no llamará “ganancia” al ingreso cobrado ni calculará margen hasta ampliar la spec de pedidos/catálogo.
- El proyecto aún no cuenta con flujo de login propio ni asignación de administradores; el acceso `/admin/login` deberá usar Supabase Auth y la primera cuenta se aprovisiona fuera de la aplicación.
