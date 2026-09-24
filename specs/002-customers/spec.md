# Feature Specification: Clientes, perfiles y direcciones

Feature Branch: `002-customers`

Created: 2026-09-20

Status: Draft

Input: User description: "Gestión de clientes para un ecommerce Supabase, con perfiles y múltiples direcciones de envío/facturación."

## User Scenarios & Testing (mandatory)

### User Story 1 - Crear y consultar perfil (Priority: P1)

Como cliente autenticado, quiero tener un perfil separado de mis credenciales de autenticación para almacenar mis datos comerciales y de contacto.

Why this priority: El perfil es la base para carritos persistentes, pedidos, direcciones y funcionalidades futuras del cliente.

Independent Test: Un usuario autenticado puede consultar y editar sus datos permitidos sin poder ver ni modificar los de otro usuario.

Acceptance Scenarios:

1. Given un usuario autenticado, When accede a su perfil, Then obtiene únicamente sus datos de perfil.
2. Given un usuario autenticado, When actualiza nombre o teléfono, Then los nuevos valores quedan persistidos.
3. Given un usuario autenticado, When intenta acceder al perfil de otro usuario, Then la operación es rechazada.

---

### User Story 2 - Administrar direcciones (Priority: P1)

Como cliente, quiero guardar varias direcciones y definir una predeterminada para agilizar futuras compras.

Why this priority: Reduce fricción del checkout y permite separar la dirección reusable del snapshot histórico de cada pedido.

Independent Test: Un usuario puede crear, editar, seleccionar como predeterminada y eliminar una dirección mientras se mantiene como máximo una dirección predeterminada activa.

Acceptance Scenarios:

1. Given un cliente sin direcciones, When crea una dirección, Then puede utilizarla en un checkout posterior.
2. Given dos direcciones existentes, When el cliente establece una como predeterminada, Then la anterior deja de ser predeterminada.
3. Given una dirección ya utilizada por un pedido, When el cliente la elimina de sus direcciones guardadas, Then el pedido histórico conserva sus datos de entrega.

---

### User Story 3 - Comprar como invitado (Priority: P2)

Como visitante, quiero poder iniciar una compra sin crear una cuenta obligatoriamente, proporcionando los datos mínimos necesarios para completar el pedido.

Why this priority: Evita convertir la creación de una cuenta en una barrera de compra.

Independent Test: Un visitante puede completar un pedido con email y dirección sin necesidad de un perfil persistente.

Acceptance Scenarios:

1. Given un visitante no autenticado con un carrito válido, When inicia checkout, Then puede indicar un email y una dirección.
2. Given un pedido creado por invitado, When finaliza la compra, Then el pedido conserva los datos necesarios sin exigir una cuenta.

### Edge Cases

- No debe existir más de una dirección predeterminada por cliente.
- Una dirección con datos incompletos no puede marcarse como válida para envío.
- Las credenciales de autenticación no forman parte de `profiles`.
- Al eliminar un usuario, los pedidos deben poder conservar las referencias históricas necesarias.

## Requirements (mandatory)

### Functional Requirements

- FR-001: System MUST associate a profile with the authenticated identity used by the application.
- FR-002: System MUST allow a customer to read and update only their own profile fields.
- FR-003: System MUST support multiple saved addresses per customer.
- FR-004: System MUST support one default address per address owner and address purpose.
- FR-005: System MUST validate required address fields before allowing an address to be used for fulfillment.
- FR-006: System MUST preserve historical order address data independently from saved-address lifecycle changes.
- FR-007: System MUST support guest checkout without requiring a persistent customer account.
- FR-008: System MUST protect customer profile and address data from cross-account access.

### Key Entities

- Profile: datos de negocio asociados a una identidad autenticada.
- Address: dirección reusable perteneciente a un cliente.
- Order Address: snapshot de una dirección usada en un pedido.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: El 100% de las consultas autenticadas de perfil devuelve datos del usuario solicitante y ninguna fila de otro usuario.
- SC-002: Cada cliente tiene como máximo una dirección predeterminada por propósito.
- SC-003: Un cliente puede completar la administración de una dirección existente en una única pantalla o flujo equivalente.
- SC-004: El 100% de los pedidos existentes conserva una dirección histórica aun cuando la dirección reusable sea editada o eliminada.

## Assumptions

- Supabase Auth es la fuente de identidad.
- El v1 contempla email/password y/o proveedores de identidad soportados por Supabase, sin acoplar el dominio a un método específico.
- Los pedidos de invitados almacenan `email` como dato propio del pedido.
- Las direcciones no se comparten entre clientes.
