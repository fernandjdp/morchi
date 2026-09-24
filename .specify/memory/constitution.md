# Tienda de Ropa y Diseño de Remeras Constitution

## Core Principles

### I. Spec-Driven Modular Architecture

Every product capability MUST be represented by a feature specification before implementation. The
canonical functional artifacts are `spec.md`, `plan.md`, and `tasks.md`; implementation MUST NOT
introduce behavior that is absent from an approved specification unless the specification is amended
first.

The system MUST preserve explicit module boundaries aligned with the domain areas defined in
`ROADMAP.md` and the `specs/` directory. Cross-module dependencies MUST be intentional, acyclic, and
limited to stable contracts or shared infrastructure primitives.

Each feature's `plan.md` MUST reference this constitution and `ARCHITECTURE.md` for decisions that are
already settled at project level. Project-wide architectural decisions MUST NOT be duplicated with
conflicting alternatives inside individual feature plans.

Rationale: a growing ecommerce combines catalog, customers, cart, orders, payments, inventory,
designs, shipping, and promotions. Stable boundaries reduce coupling and allow features to evolve
independently.

### II. Next.js Server-First Application

The application MUST use Next.js App Router as the fullstack application boundary and MUST prefer
Server Components for rendering and data access.

Client Components MUST be limited to experiences that require browser-side interactivity, local state,
Web APIs, or third-party client SDKs. Business rules MUST NOT exist only in Client Components.

Mutations MUST execute on the server through Server Functions/actions or server-side service/use-case
code. HTTP Route Handlers MUST be used for inbound integrations such as payment webhooks and other
machine-to-machine endpoints.

The codebase MUST keep domain logic independent from React rendering concerns so that core behavior
can be tested without a browser.

Rationale: server-first execution reduces client exposure, keeps secrets server-side, and creates a
clear boundary between UI composition and domain behavior.

### III. Supabase Data Integrity & Security

Supabase PostgreSQL MUST be the system of record for ecommerce domain data. Domain data MUST NOT be
duplicated into a second primary database without an explicit architectural decision.

All schema changes MUST be represented by versioned SQL migrations committed to the repository.
Application code MUST NOT depend on manually applied production-only schema changes.

Every table exposed through Supabase APIs MUST enable Row Level Security (RLS) and MUST have explicit
policies for every permitted operation. Authorization MUST be enforced server-side and MUST NOT rely
on the UI to hide unauthorized actions.

Database constraints MUST encode invariants that materially protect business data, including foreign
keys, uniqueness, non-negative monetary amounts, valid enumerated states, and quantity constraints
where appropriate.

Transactional boundaries MUST be used for operations that change multiple related records and must
remain consistent, especially checkout, inventory reservation/release, order state transitions, and
payment reconciliation.

Rationale: PostgreSQL constraints, transactions, and RLS provide defense in depth and preserve data
correctness even when clients, jobs, or integration callbacks behave unexpectedly.

### IV. Secure Boundaries & Secrets

Secrets, private API keys, service-role credentials, and payment provider access tokens MUST remain
server-only and MUST be supplied through environment variables or the hosting platform's secret store.
They MUST NOT be committed to source control, exposed to browser bundles, or persisted in ordinary
application tables.

The Supabase publishable key MAY be exposed to browser code only where required by the selected
Supabase integration pattern. Secret/service keys MUST be restricted to trusted server execution
contexts.

Inbound webhooks MUST validate authenticity according to the provider's supported mechanism before
performing state-changing operations.

User-controlled files MUST be stored in Supabase Storage or another approved object store rather than
as binary blobs in PostgreSQL unless a future architecture decision explicitly requires otherwise.

User-generated content and file names MUST be validated for size, type, ownership, and path safety.

Rationale: the application handles personal data, addresses, uploaded artwork, and payment events.
Security boundaries must remain explicit regardless of whether the caller is a browser or integration.

### V. Test-Backed Quality

Every new behavioral capability MUST have automated tests at the lowest practical layer and end-to-end
coverage for critical user journeys.

At minimum:

- Pure domain logic MUST have unit tests.
- Database-dependent behavior MUST have integration tests against an isolated test environment.
- Critical storefront journeys MUST have end-to-end tests.
- Payment webhook handling, checkout idempotency, inventory correctness, authorization, and design
  ownership MUST have dedicated tests.

Tests MUST NOT call real payment providers, shipping carriers, or other production integrations.
External services MUST be replaced by deterministic test doubles or isolated sandbox mechanisms.

A feature MUST NOT be considered complete when its tests are knowingly failing or when a regression is
fixed by weakening an existing assertion without documenting the reason.

Rationale: commerce failures can create monetary, stock, and customer-service consequences. Automated
coverage is a release gate rather than optional documentation.

### VI. Idempotent Commerce & Integration Workflows

All externally triggered state transitions MUST be safe to retry. A duplicate payment webhook,
checkout retry, job retry, or browser retry MUST NOT create duplicate orders, duplicate payments,
double stock deductions, or duplicate fulfillment records.

Provider identifiers such as payment IDs and preference IDs MUST be stored when relevant and MUST be
protected by appropriate uniqueness constraints or idempotency keys.

Order totals, prices, discounts, shipping amounts, and purchased variants MUST be snapshotted at the
time of purchase. Historical orders MUST remain reconstructable even when the current product catalog,
price, design, address, or availability changes later.

Inventory reservation, release, deduction, return, and adjustment operations MUST be represented by
explicit state transitions and/or inventory movements that leave an auditable trail.

Payment approval MUST be determined from verified provider state, not from a client redirect alone.

Rationale: ecommerce workflows cross multiple systems and are inherently retry-prone. Idempotency and
historical snapshots are core correctness properties, not implementation details.

### VII. Observable, Performant, Accessible Delivery

Production behavior MUST be diagnosable without inspecting live application memory. Important commerce
operations MUST emit structured logs or traceable events containing a correlation identifier and a
stable operation or error code, while excluding secrets and unnecessary personal/payment data.

The application MUST prefer server-side caching/revalidation for public catalog data when freshness
requirements permit and MUST avoid unnecessary client-side fetching for data that can be rendered on
the server.

Critical storefront pages MUST meet practical performance budgets established by each feature plan,
and regressions that materially affect the user journey MUST be investigated before release.

User-facing flows MUST provide accessible labels, keyboard-operable controls, readable validation
messages, meaningful loading states, and non-color-only error/success indicators. Accessibility MUST
be considered during implementation, not added only during final review.

Rationale: a storefront must be fast, understandable, and supportable. Operational visibility and
accessibility are part of product quality.

## Security & Data Governance

- Personal data MUST be limited to information required for account, checkout, fulfillment, support,
  fraud-prevention, or legal obligations.
- Payment card data MUST NOT be stored by the application unless a future audited architecture
  explicitly requires it. Payment processing SHOULD remain delegated to Mercado Pago or another
  approved provider.
- Logs MUST minimize direct personal identifiers and MUST never contain authentication secrets,
  access tokens, full payment credentials, or raw authorization headers.
- Administrative capabilities MUST use explicit authorization roles and MUST be protected by server-side
  checks and corresponding database policies where applicable.
- Public catalog information MAY be cacheable; customer, order, payment, and inventory data MUST NOT be
  accidentally exposed through public caching or static generation.
- File access MUST follow ownership rules. A user's private design asset MUST NOT be addressable by
  another user merely by guessing an object path or identifier.

## Development Workflow & Quality Gates

Every feature MUST follow this sequence unless a documented exception applies:

```text
spec.md
  -> plan.md
  -> constitution check
  -> design / data model / contracts
  -> tasks.md
  -> implementation
  -> automated tests
  -> acceptance verification
```

The project MUST keep the following architectural sources aligned:

```text
.specify/memory/constitution.md  -> governing principles
ARCHITECTURE.md                  -> project-wide technical decisions
ROADMAP.md                       -> feature decomposition and dependencies
specs/<feature>/spec.md         -> feature behavior and acceptance
specs/<feature>/plan.md         -> feature-level technical plan
specs/<feature>/tasks.md        -> implementation work
```

Every `plan.md` MUST include a Constitution Check. A plan that violates a MUST-level principle is not
implementation-ready until the specification or architecture is changed, or the constitution is
formally amended.

Every pull request that changes application behavior MUST pass, as applicable:

1. Type checking and linting.
2. Unit and integration tests.
3. End-to-end tests for affected critical journeys.
4. Database migration validation.
5. Security/authorization checks for affected data paths.
6. Build validation for the Vercel/Next.js deployment target.

Changes involving database schema, authorization, payments, inventory, or storage MUST include explicit
regression tests for the affected invariant.

## Governance

This constitution is the highest-level project governance document for implementation decisions. It
supersedes ad-hoc conventions when they conflict with a MUST-level principle.

### Authority

Principles I–VII are binding. Every feature plan MUST evaluate them through its Constitution Check.
Conflicts MUST be resolved by changing the relevant spec, plan, tasks, or this constitution before the
implementation is accepted.

### Amendments

An amendment MUST:

1. State the reason for the change.
2. Identify affected principles or sections.
3. Update the version according to the policy below.
4. Review impacted `ARCHITECTURE.md`, feature specs, plans, and tasks for contradictions.
5. Be reviewed together with its Sync Impact Report.

### Versioning Policy

Constitution versions use Semantic Versioning:

- **MAJOR** — removes or fundamentally redefines a principle, or introduces incompatible governance.
- **MINOR** — adds a new principle, governance section, or materially expands mandatory requirements.
- **PATCH** — clarifies wording without changing the intended governance.

### Compliance Review

Every feature review MUST verify compliance with the constitution. Any deviation from a MUST-level rule
MUST be explicitly documented in the relevant plan's Complexity Tracking or architecture-decision record
and MUST include the reason, scope, and mitigation.

Unjustified violations block acceptance.

Version: 1.0.0 | Ratified: 2026-09-20 | Last Amended: 2026-09-20
