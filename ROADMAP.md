# Roadmap: Plataforma de tienda de ropa y diseño de remeras

Descomposición del dominio ecommerce en módulos independientes que pueden recorrer por separado el ciclo de especificación, planificación, tareas e implementación de Spec Kit.

**Status legend:** planned · in-progress · done

| ID | Sub-feature | Intent | Scope boundary | Depends on | Status | Spec |
|---|---|---|---|---|---|---|
| 001 | Catálogo | Publicar y consultar productos vendibles, variantes, categorías e imágenes | Información comercial del catálogo; no incluye checkout ni stock transaccional | — | planned | [spec.md](specs/001-catalog/spec.md) |
| 002 | Clientes | Identificar compradores y administrar perfiles y direcciones | Identidad, perfil y direcciones; no incluye pedidos | — | planned | [spec.md](specs/002-customers/spec.md) |
| 003 | Carrito | Permitir preparar una compra antes del checkout | Selección de variantes y cantidades; no confirma pedidos ni pagos | 001, 002 | planned | [spec.md](specs/003-cart/spec.md) |
| 004 | Checkout y pedidos | Convertir un carrito en un pedido inmutable y calculado | Pedido, líneas, snapshot de dirección y totales; no procesa proveedor de pago | 001, 002, 003, 006, 009 | planned | [spec.md](specs/004-checkout-orders/spec.md) |
| 005 | Pagos | Integrar proveedores de pago y reconciliar estados | Preferencias, pagos, webhooks y reembolsos; no administra fulfillment | 004 | planned | [spec.md](specs/005-payments/spec.md) |
| 006 | Inventario | Controlar disponibilidad, reservas y movimientos de stock | Existencias físicas/lógicas y su historial; no define catálogo | 001, 004, 005 | planned | [spec.md](specs/006-inventory/spec.md) |
| 007 | Diseños y personalización | Gestionar diseños propios y personalizados para remeras | Assets, diseños, placements y snapshot de personalización | 001, 004 | planned | [spec.md](specs/007-designs/spec.md) |
| 008 | Envíos | Preparar y seguir el despacho de pedidos | Shipment, tracking y estados logísticos | 004, 005 | planned | [spec.md](specs/008-shipping/spec.md) |
| 009 | Promociones | Administrar cupones y descuentos | Reglas simples de descuento y su aplicación histórica | 001, 004 | planned | [spec.md](specs/009-promotions/spec.md) |

## Orden sugerido de implementación

1. 001 Catálogo
2. 002 Clientes
3. 003 Carrito
4. 006 Inventario
5. 009 Promociones
6. 004 Checkout y pedidos
7. 005 Pagos
8. 008 Envíos
9. 007 Diseños y personalización

La secuencia es orientativa: las especificaciones siguen límites funcionales independientes, mientras que el plan técnico de cada módulo debe resolver sus dependencias concretas.

## Convenciones

Cada módulo mantiene un `spec.md` autocontenido siguiendo la estructura actual de Spec Kit: escenarios y pruebas de usuario, requisitos funcionales, entidades, criterios de éxito y supuestos. La implementación técnica (migraciones SQL, RLS, Edge Functions, frontend, etc.) queda para `plan.md` y `tasks.md` del ciclo de cada módulo.
