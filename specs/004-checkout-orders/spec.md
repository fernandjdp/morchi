# Feature Specification: Checkout y pedidos

Feature Branch: `004-checkout-orders`

Created: 2026-09-20

Status: Draft

Input: User description: "Proceso de checkout y persistencia de pedidos para una tienda de ropa, con líneas de pedido, totales, dirección histórica y estados independientes de pago y fulfillment."

## User Scenarios & Testing (mandatory)

### User Story 1 - Revisar y confirmar checkout (Priority: P1)

Como comprador, quiero revisar productos, cantidades, descuentos, envío y total antes de confirmar el pedido.

Why this priority: El checkout es el punto donde la intención de compra se convierte en una transacción persistente.

Independent Test: Con un carrito válido, el comprador puede revisar un resumen final que coincide con las reglas de precios y descuentos vigentes y confirmar el pedido.

Acceptance Scenarios:

1. Given un carrito válido, When el comprador entra al checkout, Then ve líneas, subtotal, descuento aplicable, costo de envío estimado y total.
2. Given una variante cuyo precio cambió después de agregarla al carrito, When el comprador confirma, Then el pedido usa el precio vigente validado en ese momento.
3. Given una dirección válida, When el comprador confirma, Then esa dirección queda copiada como snapshot del pedido.

---

### User Story 2 - Crear un pedido consistente (Priority: P1)

Como sistema, quiero crear un pedido con sus líneas, precios y totales históricos para que la compra pueda auditarse aunque cambie el catálogo.

Why this priority: El histórico de pedidos debe ser inmutable respecto del contenido comercial que el cliente vio al comprar.

Independent Test: Crear un pedido y posteriormente modificar producto, variante, precio o dirección guardados no altera el contenido histórico del pedido.

Acceptance Scenarios:

1. Given un carrito confirmado, When se crea el pedido, Then cada línea almacena nombre, SKU, precio unitario, cantidad y total de línea.
2. Given un pedido existente, When cambia el nombre del producto del catálogo, Then el nombre histórico de `order_items` no cambia.
3. Given un pedido existente, When cambia el precio del producto, Then el total histórico no cambia.

---

### User Story 3 - Consultar estado del pedido (Priority: P2)

Como cliente, quiero consultar mi pedido y distinguir entre estado general, pago y fulfillment.

Why this priority: Pago, preparación y entrega pueden avanzar de forma independiente.

Independent Test: Un cliente con un pedido en preparación puede ver el estado del pedido y la información de pago/fulfillment sin acceso a pedidos ajenos.

Acceptance Scenarios:

1. Given un pedido pagado y en preparación, When el cliente lo consulta, Then puede distinguir `payment_status=approved` de `fulfillment_status=processing`.
2. Given un pedido cancelado, When el cliente lo consulta, Then el estado de negocio refleja la cancelación y no se presenta como entregable.

### Edge Cases

- Un pedido no debe poder crearse con total negativo.
- El total debe ser la suma coherente de subtotal, descuento, impuestos si existen y envío.
- El checkout debe detectar una variante agotada o inactiva antes de confirmar.
- Un pedido ya creado no debe reutilizarse para representar una segunda compra.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST create a persistent order from a valid checkout state.
- FR-002: System MUST store historical order lines independently from mutable catalog fields.
- FR-003: System MUST store historical shipping and billing address snapshots for the order.
- FR-004: System MUST persist subtotal, discounts, shipping, taxes when applicable, currency and final total.
- FR-005: System MUST maintain separate order status, payment status and fulfillment status.
- FR-006: System MUST prevent purchase confirmation when any required item is no longer buyable.
- FR-007: System MUST associate a guest order with an email even when no customer profile exists.
- FR-008: System MUST allow customers to access only their own order history.
- FR-009: System MUST preserve the historical purchase data when catalog entities are archived or removed.
- FR-010: System MUST make duplicate order creation resistant to retries of the same checkout action.

### Key Entities

- Order: representación persistente de una compra.
- Order Item: snapshot histórico de una línea comprada.
- Order Address: snapshot de la dirección utilizada en el pedido.
- Checkout: estado transitorio que reúne datos necesarios para convertir carrito en pedido.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: El 100% de los pedidos creados tiene al menos una línea de pedido y un total consistente.
- SC-002: El 100% de las líneas de pedido conserva SKU, nombre y precio histórico después de cambios en catálogo.
- SC-003: Ningún cliente autenticado puede consultar una orden de otro cliente mediante el flujo normal de lectura.
- SC-004: Reintentar la confirmación de un checkout no genera más de un pedido de negocio para la misma intención confirmada.

## Assumptions

- ARS es la moneda por defecto.
- Los impuestos se modelan como componente del total cuando la operación comercial lo requiera; no se presupone un régimen fiscal específico más allá de guardar el importe.
- El cálculo final de stock/reservas se coordina con el módulo de inventario.
- El proveedor de pago es externo al módulo de pedidos.
