# Plan: Phase 1.8 Background Jobs and Durable Queue

**Created:** 2026-08-03
**Status:** Ready for Atlas Execution

## Summary

Phase 1.8 moves provider refreshes, recommendation recomputation, and simulation work out of interactive HTTP requests. It turns the transactional outbox into durable, idempotent job dispatch with retries, observability, and version-aware result handling.

## Context & Analysis

**Relevant Files:**
- `packages/data-access/prisma/schema.prisma`: `OutboxEvent`, snapshots, and simulation runs.
- `apps/web/app/api/jobs/`: scheduled data refresh entry point.
- `docs/layers/eventing.md` and `docs/layers/workers.md`: target eventing and worker boundaries.
- `docs/simulation-design.md`: performance and reproducibility requirements.

**Key Functions/Classes:**
- `recordPick()` and pick route transactions.
- `recommend()` in `packages/recommendation/`.
- `runSimulation()` in `packages/simulation/`.

**Dependencies:**
- Phase 1.6 migrations and tests.
- Queue/broker and worker deployment choice.
- Phase 1.7 actor/team context for scoped recomputation.

**Patterns & Conventions:**
- The database remains authoritative; queue messages are derived from outbox rows.
- Every job key includes session version and algorithm/configuration version.
- Workers discard stale results instead of overwriting newer state.

## Implementation Phases

### Phase 1.8.1: Outbox Publisher and Job Contracts

**Objective:** Reliably dispatch committed draft events to a durable worker queue.

**Files to Modify/Create:**
- `packages/events/`: event schemas, outbox publisher, queue port, and adapters.
- `packages/data-access/`: outbox claim/mark-delivered repository methods.
- `apps/web/server/jobs/`: composition root and scheduled publisher trigger.

**Tests to Write:**
- `outbox-event-published-after-transaction-commit`
- `publisher-retry-is-idempotent`
- `unknown-event-is-safely-rejected`

**Steps:**
1. Define versioned payloads for pick, recommendation, simulation, and refresh events.
2. Add atomic outbox claiming and delivery markers.
3. Implement queue adapter and retries with bounded backoff.
4. Publish only committed outbox records.
5. Track publish failures and dead-letter candidates.

**Acceptance Criteria:**
- [ ] Pick transactions publish no event before commit.
- [ ] Redelivery does not duplicate downstream work.
- [ ] Queue failures remain diagnosable from durable state.

---

### Phase 1.8.2: Versioned Workers

**Objective:** Compute derived draft state without delaying user interactions.

**Files to Modify/Create:**
- `apps/web/server/jobs/`: Sleeper refresh, recommendation, and simulation handlers.
- `packages/recommendation/` and `packages/simulation/`: worker-facing orchestration input contracts.
- `packages/data-access/`: versioned result persistence and cache lookup services.

**Tests to Write:**
- `recompute-is-idempotent-by-session-version`
- `stale-worker-result-is-discarded`
- `simulation-does-not-block-pick-response`
- `provider-refresh-retries-transient-failure`

**Steps:**
1. Dispatch recommendation recomputation after each committed pick event.
2. Run simulation after preliminary recommendations are persisted.
3. Move Sleeper refresh into scheduled/job-triggered handlers.
4. Enforce session-version checks immediately before storing each result.
5. Return most-recent durable derived data while newer jobs run.

**Acceptance Criteria:**
- [ ] Pick recording stays independent of recommendation/simulation duration.
- [ ] Completed results are reproducible and version-scoped.
- [ ] Failed jobs retry safely and surface actionable diagnostics.

## Open Questions

1. Which queue should host the first worker runtime?
   - **Option A:** Managed queue compatible with the deployment platform.
   - **Option B:** Redis-backed queue with a dedicated worker service.
   - **Recommendation:** Option A if it provides durable retries and delayed jobs; otherwise choose Option B.

## Risks & Mitigation

- **Risk:** Event delivery duplicates work.
  - **Mitigation:** Use idempotency keys derived from event ID, session version, and algorithm version.
- **Risk:** Worker infrastructure becomes a second source of truth.
  - **Mitigation:** Persist all authoritative inputs/results in PostgreSQL and treat the queue as transport only.

## Success Criteria

- [ ] No expensive simulation or provider polling occurs in an interactive route.
- [ ] Outbox-to-worker processing is reliable, observable, and version-safe.

## Notes for Atlas

Do not implement WebSocket fan-out in the workers yet; publish application events first, then connect delivery in Phase 1.9.
