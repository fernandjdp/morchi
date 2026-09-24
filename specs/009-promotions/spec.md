# Feature Specification: Promociones y cupones

Feature Branch: `009-promotions`

Created: 2026-09-20

Status: Draft

Input: User description: "Sistema de cupones y descuentos para un ecommerce de ropa, con porcentajes o importes fijos, vigencia, límites de uso y registro histórico de canjes."

## User Scenarios & Testing (mandatory)

### User Story 1 - Aplicar un cupón al checkout (Priority: P1)

Como comprador, quiero ingresar un código promocional y saber cuánto descuento produce antes de pagar.

Why this priority: Es el caso de uso principal del módulo y afecta directamente el total del pedido.

Independent Test: Un cupón vigente y elegible aplicado a un checkout válido reduce el total según sus reglas.

Acceptance Scenarios:

1. Given un cupón porcentual vigente y elegible, When el comprador lo aplica, Then el descuento se calcula y se muestra en el resumen.
2. Given un cupón de importe fijo elegible, When el comprador lo aplica, Then el descuento no supera el subtotal elegible.
3. Given un cupón vencido, When el comprador lo aplica, Then es rechazado y el total permanece sin ese descuento.

---

### User Story 2 - Respetar límites de uso (Priority: P1)

Como sistema, quiero impedir usos que excedan límites configurados para una promoción.

Why this priority: Evita aplicar beneficios comerciales fuera de las condiciones definidas.

Independent Test: Un cupón con límite de usos deja de ser elegible al alcanzar el máximo configurado.

Acceptance Scenarios:

1. Given un cupón con un máximo de usos alcanzado, When un comprador intenta aplicarlo, Then el sistema lo rechaza.
2. Given un cupón ya utilizado en un pedido, When se procesa nuevamente el mismo pedido, Then no se crea un segundo canje.

---

### User Story 3 - Auditar promociones utilizadas (Priority: P2)

Como operador, quiero consultar qué cupón se utilizó, en qué pedido y por qué importe.

Why this priority: Las promociones necesitan trazabilidad para conciliación y análisis comercial.

Independent Test: Un pedido finalizado con descuento tiene un registro de redención con cupón, pedido y monto descontado.

Acceptance Scenarios:

1. Given un pedido con cupón aplicado, When el operador consulta el pedido, Then puede identificar el código promocional y el descuento efectivamente otorgado.
2. Given un pedido histórico, When cambia la configuración del cupón, Then el descuento histórico no se recalcula.

### Edge Cases

- Un cupón no puede producir un descuento negativo.
- Un descuento porcentual no puede exceder el subtotal elegible.
- Deben resolverse de forma consistente cupones vencidos, aún no vigentes y deshabilitados.
- Dos intentos concurrentes de consumir el último uso no deben exceder el límite configurado.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST support unique coupon codes.
- FR-002: System MUST support percentage and fixed-amount discount types.
- FR-003: System MUST support activation windows with optional start and expiration dates.
- FR-004: System MUST support minimum order amount when configured.
- FR-005: System MUST support maximum usage limits when configured.
- FR-006: System MUST evaluate coupon eligibility before final order creation.
- FR-007: System MUST record each successful redemption with order and discount amount.
- FR-008: System MUST prevent duplicate redemption records for the same coupon and order.
- FR-009: System MUST preserve the actual discount granted on the historical order rather than recomputing it later from mutable coupon configuration.
- FR-010: Customer-facing clients MUST NOT be allowed to arbitrarily change coupon validity or usage counters.

### Key Entities

- Coupon: regla promocional identificada por un código.
- Coupon Redemption: registro histórico de aplicación efectiva de un cupón.
- Discount: importe que se resta del subtotal/order total según las reglas aplicadas.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: Un cupón aplicado correctamente produce un descuento determinista para el mismo snapshot de checkout.
- SC-002: El 100% de los pedidos con promoción conserva el importe histórico realmente descontado.
- SC-003: Ninguna promoción supera su máximo de usos configurado aun bajo intentos concurrentes correctamente procesados.
- SC-004: Un operador puede identificar el cupón usado y su impacto monetario a partir del pedido sin recalcular reglas históricas.

## Assumptions

- El v1 contempla un solo cupón por pedido.
- No se implementan inicialmente promociones complejas por segmento, bundles, 2x1 o stacking de reglas.
- Los cupones se aplican antes de impuestos y envío salvo que una decisión futura de negocio establezca otra política.
- El total histórico del pedido es la autoridad para postventa; la configuración actual del cupón no reescribe pedidos anteriores.
