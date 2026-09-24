# Feature Specification: Carrito de compra

Feature Branch: `003-cart`

Created: 2026-09-20

Status: Draft

Input: User description: "Carrito persistente para una tienda de ropa, basado en variantes de producto y cantidades, compatible con usuarios autenticados y visitantes."

## User Scenarios & Testing (mandatory)

### User Story 1 - Agregar una variante al carrito (Priority: P1)

Como comprador, quiero agregar una variante concreta de una prenda indicando cantidad para preparar mi compra.

Why this priority: Es el mínimo funcional que conecta catálogo y checkout.

Independent Test: Desde el detalle de un producto el comprador selecciona una variante válida, la agrega y luego la encuentra en el carrito con la cantidad solicitada.

Acceptance Scenarios:

1. Given una variante activa y disponible, When el comprador la agrega, Then aparece como línea del carrito.
2. Given la misma variante ya presente, When el comprador la agrega nuevamente, Then se actualiza la cantidad de esa línea en lugar de duplicarla.
3. Given una variante inactiva, When el comprador intenta agregarla, Then la operación es rechazada.

---

### User Story 2 - Modificar carrito (Priority: P1)

Como comprador, quiero cambiar cantidades o eliminar productos antes de iniciar checkout.

Why this priority: Un carrito que no se pueda modificar no permite una experiencia de compra real.

Independent Test: El comprador puede incrementar, reducir y eliminar líneas y los totales mostrados se recalculan correctamente.

Acceptance Scenarios:

1. Given un carrito con una línea de cantidad 2, When el comprador cambia la cantidad a 3, Then el carrito refleja 3.
2. Given una línea de cantidad 1, When el comprador la elimina, Then desaparece del carrito.
3. Given un carrito con varias líneas, When cambia una cantidad, Then las demás líneas no cambian.

---

### User Story 3 - Persistir y recuperar carrito (Priority: P2)

Como cliente, quiero recuperar mi carrito al volver a la tienda para no perder el trabajo realizado.

Why this priority: La persistencia aumenta continuidad y reduce abandono por navegación accidental.

Independent Test: Un cliente autenticado agrega productos, cierra la sesión o navegación y luego recupera el carrito en una sesión posterior.

Acceptance Scenarios:

1. Given un cliente autenticado con un carrito activo, When vuelve a la tienda, Then su carrito sigue disponible.
2. Given un visitante con carrito temporal, When la aplicación mantiene su contexto de sesión, Then el carrito puede recuperarse mientras la sesión sea válida.

### Edge Cases

- La cantidad nunca puede ser menor que 1.
- Si el stock disponible disminuye, el carrito puede quedar parcialmente inválido y debe comunicarlo en checkout.
- Un producto archivado puede continuar visible en un carrito existente solo para permitir una resolución explícita antes de comprar.
- No deben existir dos líneas activas para la misma variante dentro del mismo carrito.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST support an active cart associated with an authenticated customer or anonymous session.
- FR-002: System MUST identify cart lines by product variant.
- FR-003: System MUST prevent duplicate active lines for the same variant within one cart.
- FR-004: System MUST allow quantity changes and item removal.
- FR-005: System MUST reject quantities below one.
- FR-006: System MUST validate product and variant purchaseability when a line is added.
- FR-007: System MUST revalidate current availability before checkout.
- FR-008: System MUST preserve cart state independently from the mutable catalog name or description.
- FR-009: System MUST support a cart lifecycle such as active, converted or abandoned.

### Key Entities

- Cart: conjunto de líneas que el comprador prepara antes de crear un pedido.
- Cart Item: variante y cantidad seleccionadas.
- Product Variant: unidad vendible del catálogo.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: Agregar una variante válida produce exactamente una línea activa para esa variante.
- SC-002: El 100% de las modificaciones de cantidad produce un total de carrito coherente con las líneas actuales.
- SC-003: El 100% de los carritos procesados por checkout vuelve a un estado que impide convertirlo dos veces.
- SC-004: Antes de crear un pedido, todas las líneas pasan una validación final de disponibilidad y estado.

## Assumptions

- El precio mostrado en carrito es informativo y el precio definitivo se fija al crear el pedido.
- La retención de carritos anónimos puede depender de una sesión del cliente y no requiere una cuenta permanente.
- La reserva efectiva de stock pertenece al módulo de inventario, no al carrito.
