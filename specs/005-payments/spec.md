# Feature Specification: Pagos y conciliación

Feature Branch: `005-payments`

Created: 2026-09-20

Status: Draft

Input: User description: "Integración de pagos con Mercado Pago para pedidos de una tienda de ropa, incluyendo preferencias, identificadores externos, webhooks y estados de pago."

## User Scenarios & Testing (mandatory)

### User Story 1 - Iniciar un pago (Priority: P1)

Como comprador, quiero ser derivado a un medio de pago externo para completar el pago del pedido de forma segura.

Why this priority: Sin un pago asociado un ecommerce con checkout no puede cerrar la transacción.

Independent Test: Un pedido válido produce una sesión/preferencia de pago y el comprador puede iniciar el flujo externo sin que secretos del proveedor lleguen al navegador.

Acceptance Scenarios:

1. Given un pedido pendiente válido, When el comprador inicia el pago, Then se crea una referencia externa asociada al pedido.
2. Given una solicitud repetida para el mismo pedido, When el sistema crea o recupera el pago, Then evita generar transacciones de negocio contradictorias.

---

### User Story 2 - Reconciliar pago mediante notificaciones (Priority: P1)

Como sistema, quiero actualizar el estado del pago a partir de notificaciones verificables del proveedor y no depender del retorno del navegador del comprador.

Why this priority: El resultado del pago debe ser consistente aun cuando el comprador cierre la pestaña o pierda conectividad.

Independent Test: Una notificación válida de pago aprobado cambia el pago y el pedido de forma idempotente.

Acceptance Scenarios:

1. Given un pago pendiente y una notificación válida de aprobación, When el sistema procesa la notificación, Then el pago pasa a aprobado y el pedido refleja el cambio correspondiente.
2. Given la misma notificación recibida dos veces, When se procesa de nuevo, Then no se duplican efectos de negocio.
3. Given una notificación inválida o no verificable, When el sistema intenta procesarla, Then no modifica el estado de pago.

---

### User Story 3 - Gestionar devolución/reembolso (Priority: P2)

Como operador, quiero registrar reembolsos y mantener trazabilidad del pago original para resolver cancelaciones o devoluciones.

Why this priority: Las operaciones postventa forman parte del ciclo de vida real de un pedido.

Independent Test: Un pago aprobado puede pasar a reembolsado manteniendo referencia al pago externo original.

Acceptance Scenarios:

1. Given un pago aprobado elegible para devolución, When se ejecuta el reembolso, Then el sistema registra el resultado.
2. Given un reembolso previamente confirmado, When se procesa una repetición de la misma operación, Then el estado no se duplica.

### Edge Cases

- Un webhook puede llegar antes que el usuario vuelva a la tienda.
- Un webhook puede llegar más de una vez.
- El proveedor puede enviar estados que no permiten una transición directa al siguiente estado interno.
- Un pago de importe diferente al total esperado debe quedar marcado para revisión y no habilitar automáticamente el fulfillment.
- Las credenciales del proveedor nunca deben almacenarse en tablas expuestas al cliente.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST associate each provider payment record with a local order.
- FR-002: System MUST store the provider identifier needed for payment reconciliation.
- FR-003: System MUST support an external payment preference/session identifier when the provider uses one.
- FR-004: System MUST process payment notifications idempotently.
- FR-005: System MUST verify that an incoming payment notification can be trusted before changing order payment state.
- FR-006: System MUST separate provider payment status from order business status.
- FR-007: System MUST persist amount and currency observed for the payment.
- FR-008: System MUST preserve provider raw metadata required for troubleshooting without exposing secrets to end users.
- FR-009: System MUST NOT treat a browser redirect or client-side callback alone as authoritative proof of payment approval.
- FR-010: System MUST support recording refunds/cancellations without deleting the original payment record.

### Key Entities

- Payment: registro local de una operación de pago.
- Payment Provider Reference: identificador externo del proveedor.
- Payment Notification: evento recibido desde el proveedor para reconciliación.
- Refund: resultado de una devolución total o parcial cuando corresponda.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: El 100% de los pagos persistidos está asociado a un pedido local.
- SC-002: Recibir dos veces la misma notificación produce el mismo estado final que recibirla una sola vez.
- SC-003: Ninguna aprobación externa con importe o moneda incompatibles habilita automáticamente el pedido como pagado.
- SC-004: La interrupción del navegador después del pago no impide que el pedido llegue a su estado correcto tras recibir una notificación válida.

## Assumptions

- Mercado Pago es el primer proveedor objetivo, pero el dominio no debe quedar acoplado exclusivamente a él.
- El procesamiento de webhooks ocurre en un entorno server-side controlado por la aplicación.
- Los secretos del proveedor se administran mediante secretos/variables seguras del entorno y no mediante datos públicos.
- El v1 no requiere múltiples pagos parciales por pedido salvo que una futura necesidad comercial lo introduzca.
