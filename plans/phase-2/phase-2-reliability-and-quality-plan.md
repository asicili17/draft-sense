# Plan: Phase 2 Reliability and Decision Quality

**Created:** 2026-08-01
**Status:** Ready for Atlas Execution

## Summary

Phase 2 hardens DraftSense for sustained live use and improves recommendation quality without changing the core product boundary. The work centers on multiple projection sources, consensus/comparison views, recomputation reliability, cache warming, reconnect and audit features, explainability depth, and an offline evaluation harness. By the end of this phase, the system should meet defined latency and correctness SLOs under concurrent drafts.

## Context & Analysis

**Relevant Files:**
- `docs/roadmap.md`: defines the quality and reliability goals.
- `docs/architecture.md`: defines event-driven recomputation and managed-worker escalation.
- `docs/provider-adapters.md`: defines swap-friendly provider contracts, supporting additional projection sources.
- `docs/recommendation-engine.md`: defines evaluation expectations and confidence factors.
- `docs/simulation-design.md`: defines performance optimizations and cached summaries.
- `docs/ai-integration.md`: defines the explanation boundary and future cited retrieval.

**Key Functions/Classes:**
- `mergeProjectionSources()` in provider/application services: creates consensus datasets and source comparison views.
- `recomputeRecommendationsForSessionVersion()` in orchestration services: background recomputation pipeline.
- `evaluateRecommendationRun()` in a new `packages/evaluation/`: offline quality scoring.
- `buildExplainabilityPayload()` in `packages/recommendation/` or app services: richer factor output for product surfaces.

**Dependencies:**
- Completed Phase 1 MVP.
- Production-like telemetry and structured metrics.
- Fixture or historical draft corpora for evaluation.

**Patterns & Conventions:**
- Recommendation quality improvements must remain reproducible from versioned inputs.
- Every background recomputation must be idempotent by session version and algorithm version.
- Reliability work is not permission to move decision logic into opaque providers or AI services.

## Implementation Phases

### Phase 2.1: Multi-Source Projection and ADP Support

**Objective:** Support multiple upstream data sources while keeping provider provenance and comparison visible.

**Files to Modify/Create:**
- `packages/providers/`: additional projection and ADP adapters, if enabled.
- `packages/data-access/`: source-aware datasets and consensus publication metadata.
- `packages/recommendation/`: input handling for projection-source agreement and disagreement.
- `apps/web/features/`: source comparison and freshness displays.

**Tests to Write:**
- `consensus-dataset-publication`
- `source-provenance-preserved`
- `confidence-reduced-when-sources-disagree`
- `comparison-view-api-contract`

**Steps:**
1. Extend import jobs to ingest multiple projection and ADP sources.
2. Decide how consensus datasets are created and versioned.
3. Preserve source-level values alongside any consensus output.
4. Feed source agreement into confidence scoring.
5. Expose source comparison and freshness in API/UI surfaces.

**Acceptance Criteria:**
- [ ] Multiple sources can be imported without breaking the single-session pinned-dataset model.
- [ ] Consensus logic is explicit, versioned, and auditable.
- [ ] Recommendation confidence incorporates source agreement.

---

### Phase 2.2: Background Recompute, Cache Warming, and Load Resilience

**Objective:** Make recommendation updates predictable under concurrent draft load.

**Files to Modify/Create:**
- `packages/events/`: queue consumers, stream processors, retries, DLQ or equivalent failure handling.
- `packages/recommendation/` and `packages/simulation/`: orchestration and memoization hooks.
- `apps/web/server/jobs/`: warm-cache jobs and refresh schedules.
- `observability/` or platform config: metrics, traces, alerts.

**Tests to Write:**
- `idempotent-recompute-by-session-version`
- `warm-cache-hit-for-active-sessions`
- `retry-on-transient-worker-failure`
- `load-test-latency-budget`

**Steps:**
1. Define SLOs for recommendation latency, stale update rate, and simulation turnaround.
2. Add queue retry/backoff and poison-message handling.
3. Warm recommendation and simulation caches for active sessions.
4. Add targeted load tests for concurrent draft usage.
5. Add dashboards and alerts for queue depth, recomputation latency, cache hit rate, and stale update incidence.

**Acceptance Criteria:**
- [ ] Recompute workers are idempotent and observable.
- [ ] Active draft sessions can meet latency targets under load.
- [ ] Cache warming reduces cold-start delays for live sessions.

---

### Phase 2.3: Reconnect Recovery, Shared Sessions, and Auditability

**Objective:** Improve session continuity and historical accountability.

**Files to Modify/Create:**
- `apps/web/app/api/v1/draft-sessions/[id]`: richer session reads and recovery metadata.
- `apps/web/features/draft/`: reconnect, stale-gap, and audit-history views.
- `packages/data-access/`: session-history, event, and snapshot query services.
- `packages/events/`: missed-message recovery support.

**Tests to Write:**
- `client-refetch-after-version-gap`
- `shared-session-authorization`
- `audit-history-includes-snapshots-and-picks`
- `reconnect-resumes-current-version`

**Steps:**
1. Implement resilient session refetch after socket disconnect or version gap.
2. Add support for multiple authorized viewers/participants on a session.
3. Expose pick history, recommendation history, and simulation summaries for audit.
4. Ensure shared-session permissions remain separate from provider credentials.

**Acceptance Criteria:**
- [ ] Users can reconnect and recover authoritative state without manual repair.
- [ ] Audit surfaces show how recommendations changed over time.
- [ ] Shared sessions do not weaken access control or data provenance.

---

### Phase 2.4: Explainability and Offline Evaluation Harness

**Objective:** Measure recommendation quality and expose the reasons behind rankings more deeply.

**Files to Modify/Create:**
- `packages/evaluation/`: historical fixtures, metrics, baselines, replay tooling.
- `packages/recommendation/`: richer factor serialization and explanation payloads.
- `apps/web/features/recommendation/`: views for tiers, scarcity, need, availability, and alternatives.
- `packages/ai/`: explanation enrichment using saved factor payloads only.

**Tests to Write:**
- `historical-scenario-replay`
- `adp-baseline-comparison`
- `recommendation-churn-metric`
- `explainability-payload-completeness`

**Steps:**
1. Define evaluation metrics such as ranking utility, ADP-relative utility, churn, latency, and calibration.
2. Build replay fixtures from historical scenarios and current snapshots.
3. Add explainability payloads for alternatives, scarcity context, and confidence caveats.
4. Surface these details in the UI and explanation layer without changing scoring authority.

**Acceptance Criteria:**
- [ ] The team can run offline evaluations against historical fixtures.
- [ ] Product surfaces can show why a player ranked where they did.
- [ ] Recommendation changes can be tracked and justified over time.

## Open Questions

1. Should consensus projections be computed at import time or recommendation time?
   - **Option A:** Import-time publication of consensus datasets.
   - **Option B:** Recommendation-time synthesis from source-specific datasets.
   - **Recommendation:** Option A. It preserves reproducibility, simplifies caching, and keeps recommendation inputs explicit.

2. When should simulation move to a separate worker runtime?
   - **Option A:** Immediately in Phase 2.
   - **Option B:** Only after profiling shows Vercel/server runtime limits are a real blocker.
   - **Recommendation:** Option B. Keep deployment simple until measured load justifies extraction.

## Risks & Mitigation

- **Risk:** Reliability work broadens into architecture churn with little user value.
  - **Mitigation:** Tie each workstream to concrete SLOs, reconnect behavior, or measurable recommendation quality.
- **Risk:** Multi-source consensus obscures data provenance.
  - **Mitigation:** Preserve source-level values and publish explicit consensus metadata.
- **Risk:** Evaluation harness uses leaked future information.
  - **Mitigation:** Build scenario replay from only time-appropriate inputs and versioned datasets.

## Success Criteria

- [ ] Recommendation latency and stale-update behavior meet defined SLOs.
- [ ] Multiple projection sources and consensus datasets work with clear provenance.
- [ ] Reconnect, shared sessions, and audit history are reliable.
- [ ] Evaluation and explainability tooling support quality iteration.

## Notes for Atlas

Phase 2 is where instrumentation quality matters. Do not claim reliability improvements without latency, queue, and churn measurements. Keep the deterministic engine central even as deeper explainability and evaluation tooling are added.