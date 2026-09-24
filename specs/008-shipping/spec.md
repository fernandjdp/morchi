# Feature Specification: Envíos y seguimiento

Feature Branch: `008-shipping`

Created: 2026-09-20

Status: Draft

Input: User description: "Gestión de envíos de pedidos de una tienda de ropa, con transportista, servicio, tracking, costo y estados logísticos."

## User Scenarios & Testing (mandatory)

### User Story 1 - Seleccionar una opción de envío (Priority: P1)

Como comprador, quiero conocer el costo y servicio de envío disponible para mi pedido antes de pagarlo.

Why this priority: El envío afecta el total final y es parte del consentimiento de compra.

Independent Test: Para una dirección válida, el checkout presenta opciones disponibles y refleja la selección en el total.

Acceptance Scenarios:

1. Given una dirección de entrega válida, When el comprador consulta opciones, Then recibe una o más opciones elegibles.
2. Given una opción seleccionada con costo determinado, When el comprador vuelve al resumen, Then el costo de envío forma parte del total.

---

### User Story 2 - Preparar y despachar un pedido (Priority: P1)

Como operador, quiero registrar la preparación y despacho de un pedido con un tracking para que exista trazabilidad logística.

Why this priority: El estado de fulfillment debe representar lo que ocurre después de la aprobación del pago.

Independent Test: Un pedido elegible puede pasar por estados de preparación y despacho y registrar el tracking correspondiente.

Acceptance Scenarios:

1. Given un pedido pagado y listo para fulfillment, When el operador genera el envío, Then existe un shipment asociado.
2. Given un shipment despachado, When se registra un tracking, Then el cliente puede consultar ese tracking.

---

### User Story 3 - Consultar estado de entrega (Priority: P2)

Como cliente, quiero saber si mi pedido está preparado, enviado, en tránsito o entregado.

Why this priority: Reduce incertidumbre y consultas de soporte.

Independent Test: Un cliente puede consultar el shipment de su pedido y ver el último estado conocido.

Acceptance Scenarios:

1. Given un shipment en tránsito, When el cliente consulta su pedido, Then puede ver ese estado.
2. Given un shipment entregado, When el cliente consulta su pedido, Then ve la fecha de entrega cuando está disponible.

### Edge Cases

- Un pedido cancelado no debe enviarse.
- Un tracking puede estar temporalmente ausente antes del despacho.
- Un webhook logístico repetido no debe duplicar shipments.
- Un cambio de transportista no debe destruir la trazabilidad del shipment anterior.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST associate a shipment with one order.
- FR-002: System MUST store carrier/service information when available.
- FR-003: System MUST support a tracking number independent from the internal shipment identifier.
- FR-004: System MUST support shipment lifecycle states.
- FR-005: System MUST preserve shipped and delivered timestamps when available.
- FR-006: System MUST prevent shipment initiation for orders that are not eligible for fulfillment.
- FR-007: System MUST expose shipment status to the customer only for their own order.
- FR-008: System MUST preserve the order's historical shipping address independent of later profile address changes.
- FR-009: System MUST support future integration with external carriers without making the order itself the carrier integration record.

### Key Entities

- Shipment: unidad logística asociada a un pedido.
- Shipping Option: servicio/costo elegido antes del pago.
- Tracking Reference: identificador externo para seguimiento.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: El 100% de los shipments pertenece a un pedido existente.
- SC-002: Un cliente puede identificar el estado logístico actual de un pedido elegible en una única vista.
- SC-003: El costo de envío reflejado al confirmar el pedido coincide con el costo persistido en el pedido.
- SC-004: Las actualizaciones repetidas del mismo evento logístico no crean shipments duplicados.

## Assumptions

- La integración inicial puede comenzar con un operador de logística manual y luego sumar carriers.
- El pedido conserva un snapshot de dirección y el shipment no reemplaza ese historial.
- Los estados exactos del transportista se pueden mapear a un conjunto interno estable.
