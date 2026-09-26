# Feature Specification: Catálogo de productos

Feature Branch: `001-catalog`

Created: 2026-09-20

Status: Draft

Input: User description: "Catálogo de una tienda de ropa y diseño de remeras, con productos, variantes por talle/color, categorías e imágenes."

## User Scenarios & Testing (mandatory)

### User Story 1 - Explorar productos publicados (Priority: P1)

Como visitante de la tienda, quiero explorar productos activos para conocer qué prendas están disponibles y decidir cuál ver en detalle.

Why this priority: Es la puerta de entrada al ecommerce y no depende de que el visitante tenga una cuenta.

Independent Test: Un visitante puede abrir el catálogo, ver únicamente productos publicables y acceder al detalle de un producto sin autenticarse.

Acceptance Scenarios:

1. Given un producto en estado activo, When un visitante abre el catálogo, Then el producto aparece con su nombre, imagen principal y precio desde.
2. Given un producto en estado borrador o archivado, When un visitante consulta el catálogo, Then el producto no aparece como producto vendible.
3. Given múltiples categorías, When un visitante filtra por una categoría, Then solo aparecen productos asociados a ella.

---

### User Story 2 - Consultar variantes comprables (Priority: P1)

Como comprador, quiero elegir talle y color y conocer el SKU y precio aplicables a esa combinación antes de agregar el producto al carrito.

Why this priority: En indumentaria la unidad comercial real es la variante, no solo el producto padre.

Independent Test: Para un producto con varias combinaciones, cada combinación válida puede seleccionarse y devuelve exactamente una variante vendible.

Acceptance Scenarios:

1. Given un producto con variantes de talle y color, When el comprador selecciona una combinación válida, Then la interfaz identifica una única variante.
2. Given una combinación inexistente o inactiva, When el comprador intenta seleccionarla, Then el sistema no permite comprarla.
3. Given dos variantes con la misma descripción comercial pero distinto SKU, When se consulta cada una, Then ambas conservan identificadores únicos.

---

### User Story 3 - Administrar contenido de producto (Priority: P2)

Como administrador, quiero crear, modificar, categorizar, ordenar y archivar productos para mantener actualizado el catálogo.

Why this priority: El catálogo necesita poder mantenerse sin intervención directa sobre datos de bajo nivel.

Independent Test: Un administrador puede crear un producto, asociarle variantes e imágenes, publicarlo y luego archivarlo sin perder el histórico de pedidos que lo referencien.

Acceptance Scenarios:

1. Given un producto en borrador con al menos una variante válida, When el administrador lo publica, Then el producto queda visible para compradores.
2. Given un producto activo, When el administrador lo archiva, Then deja de ser comprable pero conserva su identidad histórica.
3. Given varias imágenes, When el administrador modifica su orden, Then una sola queda designada como principal para el detalle del producto.

### Edge Cases

- Una variante no puede reutilizar un SKU ya existente.
- Un producto activo sin ninguna variante vendible no debe poder ofrecerse para compra.
- Una imagen eliminada del catálogo no debe romper un pedido histórico.
- El slug debe ser único y estable mientras sea posible para evitar enlaces ambiguos.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST support productos en estados `draft`, `active` y `archived`.
- FR-002: System MUST identify cada variante mediante un SKU único.
- FR-003: System MUST associate cada variante con como máximo una combinación de talle y color para un producto.
- FR-004: System MUST prevent duplicate product-variant combinations within the same product.
- FR-005: System MUST support categorías jerárquicas y asociación muchos-a-muchos entre productos y categorías.
- FR-006: System MUST support multiple product images with deterministic ordering.
- FR-007: System MUST distinguish catalog price data from order-history price data.
- FR-008: System MUST allow products to be archived without deleting the references required by historical orders.
- FR-009: System MUST prevent inactive variants from being added to a purchase.
- FR-010: System MUST expose only published product information to unauthenticated shoppers.
- FR-011: Before uploading a product image, the admin interface MUST show a local preview and
  validate the supported image type and size. The server MUST remain authoritative for validation,
  and stored images MUST use unique product-scoped paths with their MIME type recorded.

### Key Entities

- Product: modelo comercial de una prenda.
- Product Variant: unidad vendible definida por SKU y atributos como talle y color.
- Size: talle reutilizable del catálogo.
- Color: color reutilizable del catálogo, opcionalmente con representación visual.
- Category: clasificación navegable de productos.
- Product Image: referencia a un asset visual de un producto o variante.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: Un visitante puede pasar del catálogo al detalle de un producto publicado en una única acción de navegación.
- SC-002: El 100% de las variantes activas consultadas tiene exactamente un SKU.
- SC-003: El 100% de los productos visibles para compradores tiene al menos una variante vendible.
- SC-004: Una operación de publicación o archivado mantiene consistencia entre el estado visible y el estado comprable dentro de un ciclo de lectura posterior.

## Assumptions

- La tienda opera inicialmente en Argentina y usa ARS como moneda principal.
- El almacenamiento de archivos de imagen se gestiona fuera de la base de datos y la especificación solo requiere referencias persistentes a los assets.
- El v1 no requiere múltiples depósitos ni fabricación por lote.
- Las tallas y colores son datos administrables y reutilizables entre productos.
