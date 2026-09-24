# AGENTS.md — Guía operativa para agentes de desarrollo

## 1. Propósito

Este archivo es la guía operativa común para cualquier agente de desarrollo que trabaje en este repositorio, independientemente del modelo, proveedor, IDE, CLI o herramienta utilizada.

Su objetivo es explicar **cómo orientarse en el proyecto, qué documentos consultar, cómo transformar una necesidad en trabajo implementable y cómo verificar que el resultado cumple lo especificado**.

Este archivo no sustituye a las especificaciones del producto, la arquitectura ni la constitución del proyecto. Indica cómo usarlas.

---

## 2. Principio rector

**No empieces por el código. Empieza por el contexto.**

Antes de modificar el proyecto, determina:

1. Qué problema o comportamiento se quiere resolver.
2. Qué módulo es responsable.
3. Qué especificación(es) describen ese comportamiento.
4. Qué restricciones arquitectónicas aplican.
5. Qué trabajo ya existe y cuál falta.
6. Cómo se verificará que el cambio está terminado.

Cuando exista una especificación suficientemente precisa, úsala como fuente principal del comportamiento esperado en lugar de reconstruir requisitos a partir del código existente.

---

## 3. Jerarquía de fuentes de verdad

Cuando dos documentos parezcan entrar en conflicto, resuelve el conflicto siguiendo este orden y deja constancia de cualquier excepción:

1. **Instrucciones explícitas y vigentes del usuario para la tarea actual.**
2. `.specify/memory/constitution.md` — principios y reglas de gobierno del proyecto.
3. `ARCHITECTURE.md` — decisiones y límites arquitectónicos globales.
4. `specs/*/spec.md` — comportamiento, alcance y requisitos del módulo.
5. `ROADMAP.md` — secuencia y dependencias de alto nivel.
6. `plan.md` — diseño técnico específico de una feature.
7. `tasks.md` — ejecución concreta de una feature.
8. Código existente, migraciones, tests y configuración — evidencia del estado real del sistema.

Una implementación existente **no debe considerarse automáticamente correcta** sólo porque ya esté en producción o en el repositorio. Debe compararse con las especificaciones y restricciones vigentes.

Si una decisión existente contradice una regla superior, no la ocultes: documenta el conflicto y corrige la fuente correspondiente cuando la tarea lo permita.

---

## 4. Mapa del repositorio

La estructura principal esperada es:

```text
.
├── .specify/
│   └── memory/
│       └── constitution.md
├── AGENTS.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── README.md
└── specs/
    ├── 001-catalog/
    │   └── spec.md
    ├── 002-customers/
    │   └── spec.md
    ├── 003-cart/
    │   └── spec.md
    ├── 004-checkout-orders/
    │   └── spec.md
    ├── 005-payments/
    │   └── spec.md
    ├── 006-inventory/
    │   └── spec.md
    ├── 007-designs/
    │   └── spec.md
    ├── 008-shipping/
    │   └── spec.md
    └── 009-promotions/
        └── spec.md
```

Cuando se agreguen nuevos artefactos de Spec Kit, deben quedar dentro de su feature correspondiente o en la ubicación indicada por la estructura oficial del proyecto.

---

## 5. Qué documento leer según la tarea

### Pregunta: “¿Qué debemos construir?”
Leer:

- `specs/<feature>/spec.md`
- `.specify/memory/constitution.md`

### Pregunta: “¿Cómo debe encajar técnicamente?”
Leer:

- `ARCHITECTURE.md`
- `.specify/memory/constitution.md`
- `specs/<feature>/spec.md`

### Pregunta: “¿Qué sigue?”
Leer:

- `ROADMAP.md`
- `specs/<feature>/plan.md`, si existe
- `specs/<feature>/tasks.md`, si existe

### Pregunta: “¿Está realmente terminado?”
Comparar:

- `spec.md`
- `plan.md`
- `tasks.md`
- implementación
- tests
- estado de migraciones

Nunca concluyas “terminado” basándote solamente en que una tarea fue marcada como completada.

---

## 6. Identificación del módulo

Usa esta clasificación inicial:

| Área | Módulo |
|---|---|
| productos, variantes, talles, colores, categorías, imágenes | `001-catalog` |
| usuarios, perfiles, direcciones | `002-customers` |
| carrito y sus líneas | `003-cart` |
| checkout, pedidos, líneas del pedido, snapshots | `004-checkout-orders` |
| Mercado Pago, pagos, webhooks | `005-payments` |
| stock, reservas, movimientos de inventario | `006-inventory` |
| diseños, assets, personalización | `007-designs` |
| envíos, tracking y estados logísticos | `008-shipping` |
| cupones, descuentos y redenciones | `009-promotions` |

Una tarea puede involucrar más de un módulo. En ese caso:

1. identifica todos los módulos afectados;
2. determina cuál es el módulo propietario de la regla de negocio;
3. documenta explícitamente las dependencias entre módulos;
4. evita duplicar reglas de negocio en varios lugares.

---

## 7. Flujo de trabajo por defecto

El repositorio sigue un proceso **Spec-Driven Development**. El flujo completo recomendado es:

```text
idea / necesidad
      ↓
specify
      ↓
clarify (cuando exista ambigüedad material)
      ↓
plan
      ↓
checklist (cuando aporte valor)
      ↓
tasks
      ↓
analyze
      ↓
implement
      ↓
converge
      ↓
validación final / revisión
```

La implementación no debe adelantarse a una especificación suficientemente clara para el cambio que se está realizando.

### Si Spec Kit está instalado

Usa los comandos oficiales disponibles en el entorno, por ejemplo:

```text
/speckit-specify
/speckit-clarify
/speckit-plan
/speckit-checklist
/speckit-tasks
/speckit-analyze
/speckit-implement
/speckit-converge
```

No dependas de una herramienta concreta: si el agente actual no dispone de comandos `/speckit.*`, ejecuta manualmente el mismo proceso respetando los artefactos y reglas del repositorio.

### Regla para cambios pequeños

Un cambio pequeño no exige generar burocracia innecesaria, pero sí debe respetar la intención de este flujo:

- comprender el requisito;
- verificar el contexto y restricciones;
- implementar;
- validar;
- actualizar documentación cuando cambie el comportamiento o una decisión técnica.

### Regla para cambios grandes

Para features grandes, no intentes resolver todo en una única operación si el contexto o las dependencias lo hacen riesgoso. Divide en fases coherentes y valida cada fase antes de continuar.

---

## 8. Antes de tocar código

Realiza estas comprobaciones en este orden:

### 8.1 Inspecciona el contexto

Lee, como mínimo:

```text
README.md
.specify/memory/constitution.md
ARCHITECTURE.md
ROADMAP.md
```

Luego lee la `spec.md` del módulo afectado.

### 8.2 Inspecciona la implementación existente

Busca:

- rutas y páginas relacionadas;
- componentes involucrados;
- lógica de dominio;
- consultas a Supabase;
- migraciones existentes;
- policies RLS;
- tests existentes;
- integraciones externas;
- variables de entorno utilizadas.

No crees una nueva abstracción antes de verificar si ya existe una equivalente.

### 8.3 Comprueba el estado del repositorio

Determina:

- si hay cambios locales sin commit;
- si existen migraciones pendientes;
- si hay tests fallando antes de tocar el código;
- si existen archivos generados que no deben editarse manualmente.

No sobrescribas cambios locales no relacionados con la tarea.

---

## 9. Reglas de implementación

### 9.1 Mantener arquitectura modular

Organiza la lógica por dominio/feature y no por una única capa global gigante.

Preferir:

```text
feature/domain
  ├── components
  ├── actions / mutations
  ├── queries
  ├── schemas
  ├── services
  └── tests
```

sobre concentrar toda la lógica en archivos genéricos como:

```text
utils.ts
helpers.ts
services.ts
```

cuando eso dificulte entender a qué dominio pertenece una regla.

### 9.2 Server-first

Dado el stack del proyecto:

- usa Server Components por defecto;
- usa Client Components sólo cuando se necesite interactividad o APIs exclusivas del navegador;
- mantén mutaciones sensibles en el servidor;
- evita enviar secretos o lógica de autorización al cliente.

### 9.3 Supabase

Toda interacción con Supabase debe respetar la arquitectura documentada en `ARCHITECTURE.md`.

En particular:

- PostgreSQL es la fuente de verdad de los datos persistentes;
- los cambios de esquema se realizan mediante migraciones versionadas;
- RLS debe cubrir las tablas expuestas a clientes;
- autorización no debe depender solamente de ocultar UI;
- secretos y credenciales privilegiadas sólo pueden utilizarse del lado servidor;
- Storage se usa para archivos binarios y Postgres para sus metadatos/referencias.

### 9.4 Dinero

Los importes monetarios deben conservar precisión decimal y su moneda explícita.

No representes importes monetarios críticos con `float`/`double`.

### 9.5 Pedidos

Los `order_items` deben conservar snapshots de los datos comerciales necesarios para reconstruir históricamente la compra, aunque el producto cambie posteriormente.

No dependas de consultar el producto actual para representar correctamente un pedido histórico.

### 9.6 Inventario

Las operaciones de stock deben ser atómicas y resistentes a concurrencia.

No implementes una lógica de “leer stock → calcular → escribir stock” sin considerar condiciones de carrera.

Las reservas, ventas, liberaciones, devoluciones y ajustes deben poder auditarse mediante movimientos de inventario cuando la feature los requiera.

### 9.7 Pagos

Las confirmaciones de pago externas deben ser idempotentes.

No marques un pedido como pagado únicamente porque el usuario volvió correctamente desde un proveedor de pago.

Los webhooks y callbacks externos deben:

- validar autenticidad según la integración;
- tolerar reintentos;
- no duplicar operaciones;
- registrar suficiente contexto para investigar fallos.

### 9.8 Inputs externos

Todo input proveniente de:

- usuario;
- navegador;
- webhooks;
- APIs externas;
- archivos subidos;

debe validarse antes de entrar en lógica de dominio o persistencia.

### 9.9 Errores

No ocultes errores relevantes.

Los errores deben:

- ser distinguibles según su naturaleza;
- exponer al usuario sólo información apropiada;
- dejar suficiente contexto para diagnóstico del lado servidor;
- evitar filtrar secretos, tokens, datos sensibles o información interna.

---

## 10. Cambios de base de datos

Cuando una tarea modifica el modelo de datos:

1. identifica el `spec.md` afectado;
2. revisa `ARCHITECTURE.md`;
3. crea una migración versionada;
4. actualiza constraints, índices y RLS necesarios;
5. actualiza tipos generados si el proyecto los utiliza;
6. actualiza queries/actions relacionadas;
7. agrega o modifica tests;
8. verifica migración desde una base limpia cuando sea posible.

No modifiques manualmente la base remota como sustituto de una migración versionada.

### Regla adicional

Una nueva columna, tabla o relación debe justificar su existencia en el modelo de dominio. No agregues campos “por si acaso”.

---

## 11. RLS y autorización

Cuando una tabla sea accesible mediante la API de Supabase:

1. identifica quién puede `SELECT`;
2. identifica quién puede `INSERT`;
3. identifica quién puede `UPDATE`;
4. identifica quién puede `DELETE`;
5. verifica cómo se determina la identidad;
6. verifica que el control no dependa exclusivamente del frontend.

Para datos privados del usuario, la regla por defecto es:

```text
usuario A → datos propios
usuario B → ningún acceso a datos de A
```

Para datos administrativos:

```text
usuario público → ninguno
usuario autenticado común → ninguno
rol administrativo/backend autorizado → acceso explícito
```

No concedas permisos amplios como solución temporal sin documentar su alcance y riesgo.

---

## 12. Testing

El objetivo de los tests es verificar comportamiento, no simplemente aumentar cobertura.

Usa el nivel mínimo que demuestre correctamente cada regla:

- **unit tests** para lógica de dominio aislada;
- **integration tests** para interacciones entre módulos, DB o servicios;
- **end-to-end tests** para flujos críticos de usuario;
- **tests de RLS** cuando las políticas sean parte del comportamiento de seguridad;
- **tests de webhook/idempotencia** para integraciones de pago;
- **tests de concurrencia o invariantes** cuando exista riesgo de sobreventa o inconsistencias de stock.

Como mínimo, los cambios de negocio deben cubrir:

- camino feliz;
- validaciones relevantes;
- errores importantes;
- casos límite con impacto real.

---

## 13. Validación antes de dar una tarea por terminada

Antes de finalizar un cambio, ejecuta las comprobaciones disponibles para el proyecto. Como mínimo, cuando existan:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Usa el gestor y scripts reales definidos por el repositorio; no asumas que esos comandos existen.

Además, verifica manualmente:

- que los requisitos de la spec estén cubiertos;
- que no haya requisitos implementados sólo en frontend cuando requieren protección de backend/DB;
- que las migraciones sean reproducibles;
- que las policies RLS sean coherentes;
- que no se hayan introducido secretos en el repositorio;
- que no haya cambios accidentales fuera del alcance.

Si alguna validación no puede ejecutarse, indícalo explícitamente y explica la limitación.

---

## 14. Definition of Done

Una feature no se considera terminada simplemente porque “funciona en mi máquina”. Debe cumplir, según corresponda:

```text
[ ] La spec refleja el comportamiento esperado.
[ ] El plan técnico respeta ARCHITECTURE.md y constitution.md.
[ ] Las tareas ejecutadas cubren todos los requisitos aplicables.
[ ] El código está integrado en el módulo correcto.
[ ] Las migraciones existen y son reproducibles.
[ ] RLS/autorización están implementados donde corresponde.
[ ] Los flujos críticos tienen tests adecuados.
[ ] Lint/typecheck/tests/build pasan o las excepciones están documentadas.
[ ] No hay secretos ni credenciales expuestos.
[ ] La observabilidad/error handling necesario está presente.
[ ] La documentación relevante fue actualizada.
[ ] La revisión de convergencia no detecta huecos pendientes, o las tareas resultantes fueron procesadas.
```

---

## 15. Cómo manejar ambigüedades

No inventes requisitos silenciosamente.

Cuando falte información:

1. busca evidencia en la spec;
2. busca evidencia en arquitectura y otras specs relacionadas;
3. revisa el código existente y sus tests;
4. determina si existe una convención ya establecida;
5. si la decisión puede resolverse sin riesgo material, adopta la opción más simple y documenta el supuesto;
6. si la ambigüedad bloquea el comportamiento, marca el punto como pendiente antes de asumir una regla de negocio importante.

Las decisiones reversibles pueden resolverse pragmáticamente. Las decisiones que afecten dinero, seguridad, datos históricos, contratos externos o esquema público requieren especial cuidado.

---

## 16. Dependencias entre módulos

Cuando una feature necesita información de otro módulo, respeta su frontera de responsabilidad.

Ejemplos:

```text
catalog → define productos vendibles
inventory → administra disponibilidad
orders → registra la compra histórica
payments → confirma el estado financiero
shipping → administra fulfillment
```

Evita que:

```text
catalog
```

termine con lógica de:

```text
payments + shipping + customer + inventory + checkout
```

Una dependencia entre módulos debe ser explícita y tener una razón de dominio.

---

## 17. Evolución de las specs

Cuando durante la implementación se descubre que la spec es incorrecta o incompleta:

**no adaptes silenciosamente el código a un requisito nuevo.**

Actualiza el artefacto apropiado primero:

```text
spec.md
   ↓
plan.md
   ↓
tasks.md
   ↓
implementation
```

Si el cambio altera una decisión global, revisa también:

```text
ARCHITECTURE.md
.specify/memory/constitution.md
```

Las specs son documentos vivos. La implementación debe converger hacia ellas, y no al revés por accidente.

---

## 18. Herramientas y proveedores de IA

Este archivo **no presupone un modelo, proveedor, IDE o agente específico**.

No codifiques el proceso en función de:

- una API privada de un proveedor;
- una sintaxis exclusiva de una herramienta;
- una memoria de conversación;
- una extensión que no forme parte del repositorio;
- un comportamiento implícito que otro agente no pueda reproducir.

Cuando exista una herramienta específica disponible, úsala para acelerar el trabajo, pero la fuente de verdad debe seguir siendo el repositorio y sus artefactos versionados.

La regla práctica es:

> **Si otro agente abre el repositorio mañana y no tiene el mismo historial de conversación, debe poder reconstruir qué hacer leyendo los archivos versionados.**

---

## 19. Uso de documentación externa

Consulta documentación externa cuando:

- una API o librería pueda haber cambiado;
- exista una integración con proveedor externo;
- una decisión dependa de comportamiento actual de una plataforma;
- la documentación local no sea suficiente.

No sustituyas una decisión de arquitectura del proyecto por una recomendación genérica de un proveedor sin compararla con `ARCHITECTURE.md` y `constitution.md`.

Cuando una decisión técnica nueva dependa de una fuente externa importante, registra la decisión en el artefacto técnico correspondiente.

---

## 20. Seguridad y secretos

Nunca:

- escribas secretos reales en Markdown;
- hagas commit de tokens;
- pongas claves privadas en código cliente;
- copies credenciales de producción a fixtures;
- expongas respuestas completas de proveedores cuando contengan datos sensibles.

Usa variables de entorno y mecanismos de secretos del entorno de ejecución.

Antes de terminar una tarea, revisa los archivos nuevos y modificados para evitar filtraciones accidentales.

---

## 21. Alcance y disciplina de cambios

Haz el cambio mínimo que resuelva correctamente el requisito.

No combines en la misma tarea, salvo necesidad explícita:

- refactors masivos;
- cambios de arquitectura no relacionados;
- renombrados cosméticos extensivos;
- migraciones innecesarias;
- nuevas dependencias sin justificación.

Un cambio pequeño y verificable es preferible a una reescritura amplia difícil de revisar.

No elimines funcionalidad existente sólo para simplificar la implementación, salvo que el requisito o una decisión aprobada lo indique.

---

## 22. Git y entrega

Por defecto:

- no hagas `reset --hard`;
- no borres cambios locales ajenos a la tarea;
- no reescribas historia;
- no hagas commits ni pushes automáticamente salvo que se solicite o el flujo del entorno lo requiera;
- revisa `git diff` y `git status` antes de terminar.

El objetivo es entregar un cambio revisable y trazable.

---

## 23. Regla final

Ante cualquier duda sobre cómo actuar, vuelve a este recorrido:

```text
¿QUÉ?
  ↓
spec.md
  ↓
¿BAJO QUÉ REGLAS?
  ↓
constitution.md + ARCHITECTURE.md
  ↓
¿QUÉ EXISTE YA?
  ↓
código + migraciones + tests
  ↓
¿QUÉ FALTA?
  ↓
plan.md + tasks.md
  ↓
IMPLEMENTAR
  ↓
VALIDAR
  ↓
CONVERGE
  ↓
ACTUALIZAR DOCUMENTACIÓN SI CAMBIÓ EL CONTRATO
```

**El agente debe optimizar por corrección, trazabilidad y mantenibilidad; no por la cantidad de código producido.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
