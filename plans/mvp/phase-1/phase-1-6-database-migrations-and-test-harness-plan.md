# Plan: Phase 1.6 Database Migrations and Test Harness

**Created:** 2026-08-03
**Status:** Ready for Atlas Execution

## Summary

Phase 1.6 makes the completed MVP work deployable and safe to change. It establishes a reviewed Prisma migration workflow and adds database-backed API contract coverage for imports, picks, idempotency, and immutable recommendation snapshots.

## Context & Analysis

**Relevant Files:**
- `packages/data-access/prisma/schema.prisma`: source of durable schema changes.
- `package.json`: current database commands and workspace test entry points.
- `docs/api-design.md`: mutation, error, and idempotency contracts.
- `plans/phase-1-mvp-draft-assistant-plan.md`: Phase 1 acceptance criteria still needing coverage.

**Key Functions/Classes:**
- `importSleeperLeague()` in `packages/data-access/`.
- `recordPick()` and `undoLatestPick()` in `packages/draft-engine/`.
- Route handlers under `apps/web/app/api/v1/draft-sessions/`.

**Dependencies:**
- A dedicated test PostgreSQL database or disposable container.
- Existing Prisma schema and generated client.

**Patterns & Conventions:**
- Schema changes are committed as forward-only migrations; `db push` remains local-only if retained.
- API tests use isolated data and never depend on a developer database.
- Tests assert stable error envelopes and externally observable behavior.

## Implementation Phases

### Phase 1.6.1: Migration Workflow

**Objective:** Make schema evolution reproducible across local, CI, preview, and production environments.

**Files to Modify/Create:**
- `packages/data-access/prisma/migrations/`: generated reviewed migrations.
- `packages/data-access/package.json`: migration commands.
- Root `package.json`: workspace commands for migration deploy and test setup.
- `README.md` or `docs/`: contributor database workflow.

**Tests to Write:**
- `migration-applies-to-empty-database`
- `migration-deploy-is-idempotent`

**Steps:**
1. Confirm PostgreSQL versions and deployment migration owner.
2. Create an initial baseline migration from the current schema.
3. Add `migrate dev`, `migrate deploy`, and test-database reset commands.
4. Replace production use of schema push with migration deployment.
5. Document rollback and forward-fix expectations.

**Acceptance Criteria:**
- [ ] A clean database can be created solely from committed migrations.
- [ ] Production deployment uses `prisma migrate deploy`.
- [ ] The persisted pick idempotency schema change is represented by a migration.

---

### Phase 1.6.2: Contract and Integration Test Harness

**Objective:** Exercise the real persistence and API boundaries for the MVP workflow.

**Files to Modify/Create:**
- `apps/web/**/*.test.ts`: route contract tests.
- `packages/data-access/**/*.test.ts`: database integration tests.
- `test/` or equivalent: fixtures, setup, and database lifecycle helpers.
- CI configuration: database service and test commands.

**Tests to Write:**
- `import-sleeper-session-creates-draft-session`
- `refresh-sleeper-session-preserves-manual-picks`
- `record-pick-happy-path`
- `expected-version-conflict`
- `idempotency-key-replays-original-result`
- `recommendation-snapshot-is-immutable`

**Steps:**
1. Add isolated database setup/teardown and fixture builders.
2. Mock Sleeper only at the provider port boundary.
3. Exercise routes with real Prisma transactions.
4. Assert response status, stable error code, persisted data, and outbox rows.
5. Run the suite in CI against a clean database.

**Acceptance Criteria:**
- [ ] Critical Phase 1 API workflows run against PostgreSQL in CI.
- [ ] Tests are isolated and parallel-safe.
- [ ] Regressions in ordering, idempotency, and snapshot persistence fail deterministically.

## Open Questions

1. Should test PostgreSQL run in Docker or as a CI service?
   - **Option A:** Docker/Testcontainers locally and in CI.
   - **Option B:** A managed ephemeral CI service.
   - **Recommendation:** Option A for reproducible local and CI behavior.

## Risks & Mitigation

- **Risk:** A baseline migration diverges from deployed databases.
  - **Mitigation:** Inspect the production schema and rehearse migration deploy on a restored copy before rollout.
- **Risk:** Tests become slow or stateful.
  - **Mitigation:** Use per-test transactions or schemas and fixture factories.

## Success Criteria

- [ ] Schema state and test data can be reproduced from the repository alone.
- [ ] Core Phase 1 behavior has durable integration coverage.

## Notes for Atlas

Do not bundle unrelated schema redesigns into the migration baseline. Stabilize the existing MVP contract first.
