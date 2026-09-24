# Feature Specification: Inventario, reservas y movimientos

Feature Branch: `006-inventory`

Created: 2026-09-20

Status: Draft

Input: User description: "Inventario para una tienda de ropa con stock por variante, reservas temporales y movimientos auditables."

## User Scenarios & Testing (mandatory)

### User Story 1 - Consultar disponibilidad (Priority: P1)

Como comprador, quiero conocer si una variante puede comprarse antes de agregarla al carrito o confirmar un pedido.

Why this priority: Evita promesas de venta sobre stock inexistente.

Independent Test: Una variante con stock disponible se puede marcar comprable; una sin disponibilidad no.

Acceptance Scenarios:

1. Given quantity mayor que reserved quantity, When se consulta disponibilidad, Then la variante aparece como disponible.
2. Given quantity igual a reserved quantity, When se consulta disponibilidad, Then la variante no puede reservarse para una nueva compra.

---

### User Story 2 - Reservar stock durante checkout (Priority: P1)

Como sistema, quiero reservar unidades de una variante para reducir carreras entre compradores mientras se completa el pago.

Why this priority: El stock de indumentaria suele ser limitado por talle/color y una reserva evita sobreventa durante el checkout.

Independent Test: Dos checkouts simultáneos sobre las últimas unidades no pueden reservar colectivamente más stock del disponible.

Acceptance Scenarios:

1. Given 1 unidad disponible, When un checkout la reserva, Then el stock disponible para otros checkouts pasa a 0.
2. Given 1 unidad ya reservada, When otro checkout intenta reservar 1 unidad, Then la reserva es rechazada.
3. Given una reserva que expira o se libera, When se procesa la liberación, Then la unidad vuelve a estar disponible.

---

### User Story 3 - Auditar movimientos (Priority: P2)

Como operador, quiero conocer por qué cambió el stock de una variante para poder conciliar diferencias.

Why this priority: El inventario operativo necesita trazabilidad, no solo un número actual.

Independent Test: Una entrada, venta, devolución o ajuste genera un movimiento con tipo, cantidad y referencia contextual.

Acceptance Scenarios:

1. Given una venta confirmada, When el inventario se descuenta, Then existe un movimiento que representa la salida.
2. Given un ajuste manual, When el operador modifica el stock, Then queda un movimiento explícito de ajuste.
3. Given una devolución, When se reincorpora stock, Then queda registrado el movimiento de retorno.

### Edge Cases

- Una operación concurrente no debe permitir stock disponible negativo.
- Liberar una reserva dos veces no debe sumar unidades dos veces.
- Cancelar una orden debe liberar únicamente las reservas que realmente existían.
- Un ajuste manual debe distinguirse de una venta o devolución.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST track inventory at the sellable-variant level.
- FR-002: System MUST distinguish on-hand quantity from reserved quantity.
- FR-003: System MUST calculate sellable availability from current on-hand and reserved quantities.
- FR-004: System MUST support reservation and release operations.
- FR-005: System MUST prevent reservations that exceed current available quantity.
- FR-006: System MUST support inventory movement types for sales, reservations, releases, returns and adjustments.
- FR-007: System MUST preserve a chronological inventory movement history.
- FR-008: System MUST associate movements with a business reference when available.
- FR-009: System MUST make reservation/release actions safe against duplicate processing.
- FR-010: Customer-facing clients MUST NOT be allowed to arbitrarily change inventory quantities.

### Key Entities

- Inventory Level: cantidad física/lógica actual y cantidad reservada de una variante.
- Inventory Movement: evento que explica un cambio de inventario.
- Reservation: porción temporal de disponibilidad comprometida con una operación.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: El 100% de las reservas aceptadas mantiene disponible <= cantidad en existencia.
- SC-002: Ninguna secuencia concurrente válida permite una disponibilidad negativa.
- SC-003: Toda modificación de stock administrativo queda acompañada por un movimiento auditable.
- SC-004: Procesar dos veces el mismo evento de reserva, liberación o venta deja un único efecto efectivo.

## Assumptions

- El v1 opera con un único almacén lógico.
- No se implementa pronóstico de demanda ni compras a proveedores en este módulo inicial.
- El tiempo de expiración de una reserva se definirá en planificación técnica/configuración y no forma parte de esta especificación como valor fijo.
