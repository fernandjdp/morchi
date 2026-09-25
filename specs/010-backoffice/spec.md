# Feature Specification: Backoffice comercial y operativo

Feature Branch: `010-backoffice`
Created: 2026-09-24
Status: Draft
Input: User request: "En base a las specs actuales... genera un backoffice que permita cargar productos, manejar pedidos y visualizar métricas de ganancias, ventas y productos en tendencia."

## User Scenarios & Testing

### User Story 1 — Consultar el rendimiento de la tienda (P1)
Como administrador, quiero ver ventas, ingresos, pedidos pendientes, productos más vendidos y alertas de stock en un dashboard para decidir qué atender.

Acceptance scenarios:
1. El dashboard muestra métricas para un período seleccionable y permite compararlo con el período anterior.
2. Ingresos se calculan solo sobre pagos aprobados, restando descuentos y excluyendo pedidos cancelados/reembolsados; se muestra moneda y período.
3. Productos en tendencia se ordenan por unidades vendidas en el período, usando snapshots de pedido.
4. Sin datos suficientes se muestra un estado vacío y no se inventan métricas.

### User Story 2 — Administrar catálogo y stock (P1)
Como administrador, quiero crear, editar, publicar y archivar productos con variantes, precios y stock para mantener la tienda vendible.

Acceptance scenarios:
1. Puede crear un producto borrador, definir variantes con SKU y precio, y guardar cambios.
2. Un producto solo puede publicarse con al menos una variante activa válida.
3. Un ajuste de stock registra motivo y movimiento auditable, y no permite existencias negativas.
4. Archivar un producto impide nuevas compras y conserva referencias históricas.

### User Story 3 — Gestionar pedidos (P1)
Como administrador, quiero buscar y filtrar pedidos, consultar su detalle histórico y avanzar su preparación/envío.

Acceptance scenarios:
1. La lista muestra número, cliente, fecha, total, estado de pago y estado de fulfillment.
2. El detalle usa snapshots del pedido y muestra líneas, dirección y eventos relevantes.
3. Se puede cambiar fulfillment mediante transiciones válidas sin modificar payment_status.
4. Los cambios de estado quedan registrados y no confirman un pago manualmente.

### User Story 4 — Restringir acceso (P1)
Como propietario de la tienda, quiero que solo usuarios autorizados accedan al backoffice y que la autorización se compruebe en el servidor.

Acceptance scenarios:
1. Usuario no autenticado es enviado al inicio de sesión.
2. Usuario autenticado sin rol administrativo recibe denegación y no obtiene datos privados.
3. Intentar invocar directamente una acción protegida sin rol válido falla.

## Requirements

- FR-001: El sistema MUST proteger todas las rutas, lecturas y mutaciones administrativas con autenticación y autorización server-side.
- FR-002: La condición administrativa MUST provenir de metadata confiable administrada del lado servidor (Supabase Auth `app_metadata`), nunca de metadata editable por el usuario.
- FR-003: El backoffice MUST permitir crear, editar, publicar y archivar productos, variantes y categorías respetando `001-catalog`.
- FR-004: El backoffice MUST permitir consultar inventario y registrar ajustes con motivo mediante operaciones atómicas y movimientos auditables respetando `006-inventory`.
- FR-005: El backoffice MUST permitir buscar, filtrar, paginar y consultar pedidos y sus snapshots respetando `004-checkout-orders`.
- FR-006: El backoffice MUST permitir transiciones permitidas de fulfillment con historial; MUST NOT tratar una acción administrativa como confirmación de pago.
- FR-007: El dashboard MUST mostrar monto cobrado neto de descuentos, cantidad de ventas aprobadas, pedidos, unidades vendidas, tendencias de productos y alertas de stock, con período y moneda explícitos.
- FR-008: Los cálculos MUST basarse en pagos/pedidos persistidos, usar numeric/precisión decimal en el servidor y excluir pedidos que no representen ventas aprobadas.
- FR-009: Las consultas administrativas MUST ser dinámicas, paginadas cuando corresponda y no cachearse públicamente.
- FR-010: Las acciones MUST validar input en servidor, revalidar solo las vistas afectadas y preservar los límites de cada módulo.
- FR-011: El acceso privilegiado MUST usar una sesión autenticada y checks de rol antes de usar credenciales con bypass de RLS.

## Key Entities

- Administrator: usuario Supabase Auth cuyo `app_metadata.role` es `admin`.
- Dashboard Period: rango temporal de consulta y comparación.
- Sales Metric: agregado derivado de pedidos con pago aprobado.
- Order Activity: registro de transición administrativa de fulfillment con actor, estado previo/nuevo y fecha.

## Success Criteria

- SC-001: El 100% de rutas y mutaciones backoffice deniega acceso a usuarios sin `app_metadata.role=admin`.
- SC-002: El dashboard produce agregados reproducibles desde los pedidos y pagos fuente y declara período/moneda.
- SC-003: Toda modificación manual de existencias produce exactamente un movimiento con actor y motivo.
- SC-004: Las transiciones administrativas no pueden cambiar payment_status ni alterar snapshots históricos.

## Assumptions

- ARS es la moneda de operación inicial; los paneles agrupan por moneda si posteriormente existen varias.
- Los administradores se aprovisionan por un mecanismo confiable fuera de la UI (Supabase Auth dashboard/administración protegida), ajustando `app_metadata.role`; no existe registro público de administradores.
- La tendencia inicial se define por unidades vendidas en el período seleccionado; no se presenta como predicción.
- La rentabilidad se refiere inicialmente a ventas netas cobradas, no a ganancia contable: el costo histórico no está presente en `order_items`. Para calcular margen real se requiere snapshot histórico de costo y su propia especificación.
- No se incluyen reembolsos iniciados desde el backoffice; pagos siguen gobernados por `005-payments`.
