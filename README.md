# Specs — Tienda de ropa y diseño de remeras

Esta carpeta descompone el dominio ecommerce en nueve sub-features con un `spec.md` independiente por módulo y un `ROADMAP.md` para sus dependencias.

## Estructura

```text
.specify/
└── memory/
    └── constitution.md
ARCHITECTURE.md
ROADMAP.md
specs/
├── 001-catalog/spec.md
├── 002-customers/spec.md
├── 003-cart/spec.md
├── 004-checkout-orders/spec.md
├── 005-payments/spec.md
├── 006-inventory/spec.md
├── 007-designs/spec.md
├── 008-shipping/spec.md
└── 009-promotions/spec.md
```

## Uso con Spec Kit

Cada directorio puede evolucionar de forma independiente con el ciclo de Spec Kit:

```text
spec.md → plan.md → tasks.md → implement
```

El `ROADMAP.md` sirve como descomposición inicial del sistema completo y como referencia entre sub-features.

La constitución de `.specify/memory/constitution.md` define las reglas no negociables del proyecto: arquitectura modular, Next.js server-first, Supabase/RLS, seguridad, testing, idempotencia, observabilidad y gobierno de cambios. Spec Kit la carga como contexto de gobernanza al generar nuevas specs y planes.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local   # completar con claves reales
pnpm dev
```

Variables requeridas (ver `.env.example`):

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY              # server-only
MERCADOPAGO_ACCESS_TOKEN         # server-only
MERCADOPAGO_WEBHOOK_SECRET       # server-only
NEXT_PUBLIC_SITE_URL
```

Migraciones y esquema: ver [`supabase/README.md`](supabase/README.md).

Comandos:

```bash
pnpm dev         # desarrollo
pnpm build       # build de producción
pnpm typecheck   # tsc --noEmit
```
