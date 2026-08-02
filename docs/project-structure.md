# Project Structure and Engineering Standards

## Proposed folder structure

```text
apps/web/
  app/                 Next.js routes, layouts, pages
  components/          UI composition and shadcn/ui wrappers
  features/            draft, league, player feature presentation
  lib/                 client-safe helpers
  server/              route handlers, auth, composition root
packages/
  domain/              sport-neutral entities, rules, interfaces
  draft-engine/        ordering, validation, roster construction
  recommendation/      scoring pipeline and factor contracts
  simulation/          trial runner and opponent strategies
  providers/           provider ports, adapters, normalizers, and fixtures
  data-access/         Prisma repositories and migrations
  events/              outbox, stream, WebSocket contracts
  ai/                  explanation service and schemas
  sport-nfl/           NFL positions, rules, adapters
  config/              shared TypeScript, lint, test configuration
```

Start as a workspace only when shared packages justify it; the boundaries remain valid inside one application. Sport packages implement domain interfaces for positions, eligibility, roster rules, scoring, projection parsing, and opponent defaults. No UI or route handler imports a concrete sport implementation directly.

## Naming and service architecture

Use `kebab-case` filenames, `PascalCase` React components/types, `camelCase` functions and variables, and explicit domain names (`DraftSession`, not `Data`). Keep server-only code out of client bundles. Route handlers authenticate, validate schemas, call one application service, and translate domain errors; they contain no business rules.

Application services orchestrate repositories, engines, events, and external clients. Domain engines are deterministic and unit-testable. Repositories hide Prisma; adapters hide Redis, OpenAI, providers, and transport. Depend on interfaces defined by the consuming domain package.

## Dependency injection

Use an explicit composition root in server startup that constructs repositories, clock/ID providers, event publisher, simulation dispatcher, AI client, and external-data adapters. Pass dependencies through constructors or factory functions. Tests provide in-memory/fake implementations; avoid global mutable singletons. Scoped request context carries request ID and authenticated actor, not business state.

## Coding standards and testing

Use TypeScript strict mode; validate all transport and provider input at boundaries with a shared schema library; prefer immutable values and exhaustive enum handling. Keep functions focused, errors typed and stable, and logs structured without personal or secret data. Format and lint through repository scripts once established.

Test the recommendation and draft engines with deterministic unit tests, property tests for roster/pick invariants, repository integration tests against Postgres, API contract tests, WebSocket integration tests, and end-to-end draft flows. Use fixed seeds and versioned fixtures for simulations. Test OpenAI adapters with recorded schema-conformant responses; never require live model calls in CI.

