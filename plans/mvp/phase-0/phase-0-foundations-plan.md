# Plan: Phase 0 Foundations

**Created:** 2026-08-01
**Status:** Ready for Atlas Execution

## Summary

Phase 0 turns the current documentation-only repository into a runnable DraftSense foundation. The goal is to establish the application skeleton, core package boundaries, managed deployment assumptions, persistence layer, provider adapter interfaces, and the first automated dataset import path. By the end of this phase, a local environment should be able to import NFL player/projection and ADP data into versioned datasets and expose enough infrastructure for later draft-session work.

## Context & Analysis

**Relevant Files:**
- `docs/roadmap.md`: defines the Phase 0 milestone and provider set.
- `docs/architecture.md`: defines the modular monolith, Vercel deployment, and persistence/event boundaries.
- `docs/project-structure.md`: defines the target module layout and testing expectations.
- `docs/provider-adapters.md`: defines application-owned provider ports and normalization rules.
- `docs/database-schema.md`: defines the initial durable models and dataset versioning.

**Key Functions/Classes:**
- `LeaguePlatformProvider`, `ProjectionProvider`, `AdpProvider` in `packages/providers/`: external provider ports.
- `publishProjectionDataset()` in `packages/data-access/`: persists immutable imports and associated metadata.
- `buildAppContainer()` in `apps/web/server/`: composition root wiring repositories, providers, Redis, and OpenAI clients.

**Dependencies:**
- `Next.js + TypeScript`: application shell and server routes.
- `Prisma + PostgreSQL`: durable storage and migrations.
- `Redis`: cache, queues/streams, idempotency, and presence foundation.
- `Zod`: boundary validation for API and provider normalization.
- `Vitest` and `fast-check`: deterministic unit and property tests.

**Patterns & Conventions:**
- No provider SDK or raw provider payload crosses the `packages/providers/` boundary.
- All imported datasets are immutable and versioned.
- All domain services must be transport-agnostic and unit-testable.
- The project starts as a modular monolith; package boundaries matter even before extraction.

## Implementation Phases

### Phase 0.1: Repository and Runtime Skeleton

**Objective:** Create the application/package layout, baseline tooling, and deployment/runtime configuration.

**Files to Modify/Create:**
- `package.json`, workspace config, TypeScript configs, lint/format configs, test configs.
- `apps/web/`: Next.js app shell, route groups, server composition root, environment validation.
- `packages/config/`: shared TS, ESLint, Vitest, and runtime schema config.
- `.github/workflows/` or equivalent CI config: lint, typecheck, tests, Prisma validation.

**Tests to Write:**
- `workspace-build-smoke`: verifies the repo installs, typechecks, and runs the basic app shell.
- `env-schema-validation`: verifies required environment variables are validated with friendly failures.

**Steps:**
1. Create the workspace structure from `docs/project-structure.md`.
2. Enable TypeScript strict mode and shared lint/test configuration.
3. Add environment schema validation for Postgres, Redis, provider credentials, and OpenAI keys.
4. Add CI that runs install, typecheck, lint, tests, and migration checks.
5. Add README/dev bootstrap instructions for local setup aligned with managed deployment assumptions.

**Acceptance Criteria:**
- [ ] A developer can install dependencies, validate env vars, and boot the app locally.
- [ ] CI runs basic repository quality gates.
- [ ] Package boundaries exist for all planned modules even if some are placeholders.

---

### Phase 0.2: Persistence and Domain Foundations

**Objective:** Implement the first durable schema and repository contracts required for players, scoring formats, datasets, provider imports, and draft-session foundations.

**Files to Modify/Create:**
- `packages/data-access/prisma/schema.prisma`: initial schema for `User`, `League`, `LeagueIntegration`, `ScoringFormat`, `Player`, `PlayerExternalIdentity`, `ProjectionDataset`, `ProviderImport`, `PlayerProjection`, `DraftSession`, `DraftTeam`, `DraftPick`, `RecommendationSnapshot`, `SimulationRun`, `OutboxEvent`.
- `packages/data-access/src/repositories/`: repository interfaces and Prisma implementations.
- `packages/domain/`: enums, value objects, IDs, error types, and domain contracts.

**Tests to Write:**
- `prisma-migration-smoke`: applies migrations to a test database.
- `player-external-identity-uniqueness`: enforces provider identity uniqueness.
- `dataset-versioning-persistence`: verifies immutable dataset publication and lookup.
- `draft-pick-uniqueness`: verifies `(sessionId, overallPick)` and `(sessionId, playerId)` invariants.

**Steps:**
1. Translate the schema outline into actual Prisma models with indices and enums.
2. Add migration scripts and seed data for at least one NFL scoring format preset.
3. Define repository interfaces before Prisma implementations.
4. Implement repository integration tests against Postgres.
5. Add transaction helpers for future outbox and draft-pick consistency.

**Acceptance Criteria:**
- [ ] Prisma schema reflects the documented durable model boundaries.
- [ ] Repositories can persist and retrieve versioned datasets and player identities.
- [ ] Integration tests cover core uniqueness and versioning invariants.

---

### Phase 0.3: Provider Ports, Adapters, and Import Pipelines

**Objective:** Build provider integrations behind stable ports and publish normalized, versioned datasets from automated imports.

**Files to Modify/Create:**
- `packages/providers/src/ports/`: `LeaguePlatformProvider`, `ProjectionProvider`, `AdpProvider`.
- `packages/providers/src/sleeper/`, `packages/providers/src/fantasypros/`, `packages/providers/src/fantasy-football-calculator/`: concrete adapters.
- `packages/providers/src/normalizers/`: provider-to-domain mapping and validation.
- `apps/web/server/jobs/` or `packages/events/`: scheduled import orchestration.
- `packages/data-access/src/imports/`: `ProviderImport` persistence and dataset publication services.

**Tests to Write:**
- `sleeper-contract-normalization`
- `fantasypros-projection-normalization`
- `ffc-adp-normalization`
- `ambiguous-player-match-quarantine`
- `provider-error-mapping`

**Steps:**
1. Define normalized DraftSense contracts for league snapshots, draft snapshots, projection imports, and ADP imports.
2. Implement raw-response fixture tests per provider.
3. Implement external ID matching with ambiguity quarantine instead of best-guess linking.
4. Persist `ProviderImport` audit records with payload hashes and diagnostics.
5. Publish successful projection and ADP imports as immutable datasets.
6. Add scheduled job entry points and manual re-run hooks for development.

**Acceptance Criteria:**
- [ ] Providers are isolated behind application-owned interfaces.
- [ ] Automated imports publish versioned datasets without leaking provider response shapes.
- [ ] Failed imports preserve the last successful dataset and surface provider-neutral errors.

---

### Phase 0.4: Composition Root, Observability, and Handoff Readiness

**Objective:** Wire the app runtime and expose the minimum internal seams needed for later feature phases.

**Files to Modify/Create:**
- `apps/web/server/container/`: composition root and dependency injection.
- `apps/web/server/logging/`: structured logging and request IDs.
- `packages/events/`: outbox abstractions, Redis client setup, and queue/stream contracts.
- `apps/web/app/api/health` or similar diagnostics endpoints.

**Tests to Write:**
- `container-wiring-smoke`
- `request-id-propagation`
- `redis-connection-fallback-behavior`

**Steps:**
1. Create a container that constructs repositories, provider adapters, Redis clients, and OpenAI client placeholders.
2. Add structured logs, request IDs, and health checks.
3. Create empty but typed events/outbox interfaces for later draft-event use.
4. Document local/dev/prod runtime expectations and deployment assumptions.

**Acceptance Criteria:**
- [ ] The app has a single composition root with no global mutable business singletons.
- [ ] Observability basics exist before higher-level features are added.
- [ ] Phase 1 can build on stable provider, data-access, and runtime seams.

## Open Questions

1. Should the repository start as a true workspace or a single Next.js app with internal package folders?
   - **Option A:** Full workspace from the start.
   - **Option B:** Single app plus local packages extracted only when needed.
   - **Recommendation:** Option A. The docs already assume explicit package boundaries, and Phase 0 is the cheapest time to enforce them.

2. How should scheduled imports run initially on Vercel?
   - **Option A:** Vercel cron jobs triggering protected route handlers.
   - **Option B:** External scheduler or worker service from day one.
   - **Recommendation:** Option A. It matches the initial deployment target and is sufficient before simulation load requires separate workers.

## Risks & Mitigation

- **Risk:** Provider normalization work overruns because raw payloads are inconsistent.
  - **Mitigation:** Use recorded fixtures, strict schemas, and ambiguity quarantine instead of implicit mapping.
- **Risk:** Premature coupling between UI and provider shapes leaks through route handlers.
  - **Mitigation:** Enforce provider contracts in dedicated packages and validate route payloads against DraftSense-owned DTOs only.
- **Risk:** Schema churn causes repeated migration resets.
  - **Mitigation:** Keep Phase 0 focused on durable shared entities and defer speculative product tables.

## Success Criteria

- [ ] Local and CI environments are reproducible.
- [ ] Core package boundaries and shared tooling are in place.
- [ ] Provider imports create immutable projection and ADP datasets.
- [ ] Persistence, provider, and runtime seams are ready for draft-session development.

## Notes for Atlas

This phase should end with a usable skeleton, not placeholder-only code. Prioritize durable seams: Prisma schema, provider contracts, fixture-backed adapters, and a working import path. Do not start draft UI or recommendation logic before versioned datasets can be loaded reliably.
