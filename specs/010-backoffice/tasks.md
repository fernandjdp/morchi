# Tareas: Backoffice (010-backoffice)

- [x] T001 Agregar migración para auditoría de actividad administrativa, protección RLS/grants y RPC transaccional para ajuste de inventario.
- [x] T002 Implementar autorización de administrador basada en Supabase Auth `app_metadata.role`.
- [x] T003 Crear layout administrativo y acceso/login protegido.
- [x] T004 Implementar queries de dashboard con períodos 7/30/90 días, ventas cobradas, comparación, tendencias y alertas.
- [x] T005 Crear dashboard responsive con estados vacíos y gráficos/tablas legibles.
- [x] T006 Implementar catálogo administrativo para productos, variantes, imágenes, asignación de categoría, publicación y archivo. (La gestión de jerarquías sigue pendiente.)
- [x] T007 Implementar lista/detalle de pedidos con búsqueda, filtros y detalle histórico. (Paginación avanzada pendiente; límite actual 100.)
- [x] T008 Implementar transiciones de fulfillment con validación, control de concurrencia e historial del actor.
- [x] T009 Implementar vista de inventario y ajuste de stock atómico con motivo y actor.
- [ ] T010 Validar migración en Supabase y build de producción. Typecheck pasó; el build falló porque el entorno no pudo descargar las fuentes Google Fonts existentes en el proyecto. La migración no se aplicó por falta de base Supabase configurada.
