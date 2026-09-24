# Feature Specification: Diseños y personalización de remeras

Feature Branch: `007-designs`

Created: 2026-09-20

Status: Draft

Input: User description: "Sistema de diseños para una tienda de remeras, incluyendo diseños predeterminados, archivos del cliente, ubicaciones de impresión y configuración de personalización asociada a cada línea de pedido."

## User Scenarios & Testing (mandatory)

### User Story 1 - Elegir un diseño disponible (Priority: P1)

Como comprador, quiero elegir un diseño compatible con una prenda y visualizar dónde se aplicará antes de agregarla al carrito.

Why this priority: Conecta el catálogo de prendas con la propuesta de valor de diseño.

Independent Test: Un producto con diseños disponibles permite seleccionar uno y conserva la elección al avanzar al carrito.

Acceptance Scenarios:

1. Given un producto con un diseño habilitado para frente, When el comprador lo selecciona, Then la configuración identifica el diseño y placement elegido.
2. Given un diseño no asociado al producto, When el comprador intenta aplicarlo, Then el sistema rechaza la combinación.

---

### User Story 2 - Crear una personalización propia (Priority: P1)

Como comprador, quiero cargar un diseño propio y configurarlo sobre una prenda para solicitar una remera personalizada.

Why this priority: Es una capacidad diferenciadora del negocio de diseño de remeras.

Independent Test: Un cliente puede crear una personalización con un asset válido, elegir placement y revisar una previsualización antes de confirmar.

Acceptance Scenarios:

1. Given un archivo compatible, When el cliente lo carga, Then el sistema crea un asset asociado a su diseño.
2. Given un diseño propio y una variante de remera compatibles, When el cliente lo ubica en el frente, Then la configuración queda guardada.
3. Given una configuración incompleta, When intenta confirmar el pedido, Then el sistema solicita resolver las configuraciones obligatorias.

---

### User Story 3 - Conservar la personalización histórica (Priority: P1)

Como operador, quiero que la personalización de una línea de pedido quede congelada para producir exactamente lo que el cliente compró aunque luego modifique su diseño.

Why this priority: Producción y postventa requieren un registro histórico independiente de futuras ediciones.

Independent Test: Una vez creado el pedido, modificar el diseño original no cambia la configuración almacenada para la línea del pedido.

Acceptance Scenarios:

1. Given una línea de pedido con una personalización, When el cliente edita el diseño original, Then el pedido mantiene el snapshot previo.
2. Given un asset eliminado del área de trabajo del cliente, When un operador consulta un pedido histórico, Then el pedido conserva la referencia necesaria o una copia operativa de la configuración.

### Edge Cases

- Un archivo demasiado grande, corrupto o de tipo no soportado debe rechazarse.
- Una personalización puede tener múltiples assets.
- Un mismo diseño puede aplicarse a diferentes placements si el producto lo permite.
- El cliente no debe poder editar el diseño propietario de otra persona.
- La eliminación posterior de un diseño reusable no debe invalidar una orden ya confirmada.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST distinguish product catalog data from reusable/custom design data.
- FR-002: System MUST support design types such as custom, uploaded and store-provided templates.
- FR-003: System MUST associate design assets with their owning design.
- FR-004: System MUST allow products to declare compatible design placements.
- FR-005: System MUST persist placement/configuration information for each customized order line.
- FR-006: System MUST preserve an immutable or otherwise self-contained customization snapshot for confirmed orders.
- FR-007: System MUST validate ownership/access before allowing a customer to read or modify a private design.
- FR-008: System MUST validate supported file types and size limits before accepting uploaded assets.
- FR-009: System MUST support a preview reference for designs where the product workflow provides one.
- FR-010: System MUST prevent a customization from referencing a product/placement combination that is not supported.

### Key Entities

- Design: definición reutilizable o personalizada de un diseño gráfico.
- Design Asset: archivo o recurso visual perteneciente a un diseño.
- Product Design: relación entre un diseño y un producto/placement compatible.
- Order Item Customization: configuración histórica aplicada a una línea comprada.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: El 100% de las personalizaciones confirmadas referencia un producto/variante compatible.
- SC-002: El 100% de los assets aceptados cumple las validaciones de formato y tamaño configuradas.
- SC-003: Modificar un diseño reutilizable después de una compra no modifica la configuración histórica del pedido.
- SC-004: Un cliente nunca puede recuperar un diseño privado de otro cliente mediante el flujo normal de aplicación.

## Assumptions

- Supabase Storage se utiliza para los archivos.
- El v1 admite placements de frente, espalda, pecho izquierdo y/o manga, pero el conjunto definitivo se puede ampliar.
- No se define aquí el motor de renderizado del editor; la especificación solo fija las capacidades y datos persistentes.
- El archivo listo para producción puede requerir procesamiento posterior y validaciones adicionales fuera de este módulo.
