# Plan: Phase 1 MVP Draft Assistant

**Created:** 2026-08-01
**Status:** Ready for Atlas Execution

## Summary

Phase 1 delivers the first end-to-end DraftSense product on top of the dedicated frontend/UI phase. A user can connect a Sleeper league, create or refresh a draft session pinned to imported datasets, view a live board through the prepared UI shells, record or correct picks, receive deterministic recommendations, run next-pick availability simulations, and request AI-generated explanations. This phase should complete the MVP behavior for one user-managed NFL roster while plugging real services into the previously defined product experience.

## Context & Analysis

**Relevant Files:**
- `docs/roadmap.md`: defines the MVP scope and milestone.
- `docs/api-design.md`: defines the initial REST and WebSocket surfaces.
- `docs/database-schema.md`: defines sessions, teams, picks, snapshots, and simulation runs.
- `docs/recommendation-engine.md`: defines the deterministic recommendation pipeline.
- `docs/simulation-design.md`: defines Monte Carlo availability estimation.
- `docs/ai-integration.md`: defines the explanation-only AI boundary.

**Key Functions/Classes:**
- `importSleeperLeague()` in application services: creates or refreshes a `DraftSession` from normalized provider data.
- `recordDraftPick()` in `packages/draft-engine/`: validates order, legality, version, and idempotency.
- `recommend()` in `packages/recommendation/`: returns scored candidates and factor breakdowns.
- `runSimulation()` in `packages/simulation/`: produces availability summaries for top candidates.
- `generateExplanation()` in `packages/ai/`: turns a saved recommendation snapshot into structured explanation text.

**Dependencies:**
- Phase 0 provider imports and schema.
- Phase 0.5 frontend/UI research, IA, and feature-shell scaffolding.
- Redis-backed outbox/queue or equivalent job dispatch.
- WebSocket support for session updates.
- Recorded AI fixtures for explanation testing.

**Patterns & Conventions:**
- Server state is authoritative; the client never computes recommendations.
- Recommendations are reproducible from session version, dataset version, algorithm version, and inputs.
- AI failures must degrade explanations only, never draft or ranking behavior.
- Manual picks are permitted when imported draft snapshots are stale.

## Implementation Phases

### Phase 1.1: Sleeper Session Import and Draft Session Lifecycle

**Objective:** Let a user discover Sleeper leagues and create or refresh a DraftSense session from a selected league.

**Files to Modify/Create:**
- `apps/web/app/`: route integration for league lookup, session creation, and session resume using the UI shells from Phase 0.5.
- `apps/web/app/api/v1/integrations/sleeper/leagues`
- `apps/web/app/api/v1/draft-sessions/imports/sleeper`
- `packages/providers/`: league snapshot retrieval and normalization.
- `packages/data-access/`: `League`, `LeagueIntegration`, `DraftSession`, `DraftTeam` services.

**Tests to Write:**
- `find-sleeper-leagues-api-contract`
- `import-sleeper-session-creates-draft-session`
- `refresh-sleeper-session-updates-non-final-state`
- `stale-upstream-fallback-allows-manual-picks`

**Steps:**
1. Build the Sleeper username lookup flow and normalized league list.
2. Map imported league settings into DraftSense scoring/roster/session settings.
3. Create or refresh `DraftSession`, `League`, and `DraftTeam` rows with source linkage.
4. Pin the current projection and ADP dataset versions at session import time.
5. Record sync timestamps and source metadata for future refreshes.

**Acceptance Criteria:**
- [ ] A user can import an eligible Sleeper league into a DraftSense session.
- [ ] Imported sessions capture roster/scoring details and draft-team structure.
- [ ] Session import pins exact dataset versions for reproducible recommendations.

---

### Phase 1.2: Draft Engine and Manual Pick Workflow

**Objective:** Implement authoritative draft-state mutation, validation, undo, and stale-snapshot fallback behavior.

**Files to Modify/Create:**
- `packages/draft-engine/`: draft order, eligibility, roster validation, undo rules.
- `apps/web/app/api/v1/draft-sessions/[id]`
- `apps/web/app/api/v1/draft-sessions/[id]/picks`
- `apps/web/app/api/v1/draft-sessions/[id]/picks/[overallPick]`
- `packages/events/`: transactional outbox event creation.

**Tests to Write:**
- `record-pick-happy-path`
- `expected-version-conflict`
- `duplicate-player-rejected`
- `undo-latest-pick-only`
- `outbox-written-with-pick-transaction`
- `manual-pick-fallback-does-not-bypass-validation`

**Steps:**
1. Implement draft order and team turn calculation.
2. Validate player availability and roster legality during pick recording.
3. Enforce idempotency and expected-version semantics.
4. Persist picks transactionally with outbox events.
5. Implement latest-pick undo rules for authorized users.
6. Expose session reads with picks, teams, version, and source freshness metadata.

**Acceptance Criteria:**
- [ ] Draft picks are immutable events with strict ordering and uniqueness guarantees.
- [ ] Conflicting or illegal picks return stable domain errors.
- [ ] Manual corrections work without bypassing business rules.

---

### Phase 1.3: Deterministic Recommendation Engine

**Objective:** Produce roster-aware ranked recommendations with transparent factor breakdowns.

**Files to Modify/Create:**
- `packages/recommendation/`: scoring pipeline, factor contracts, normalization, confidence calculation.
- `packages/sport-nfl/`: NFL roster rules, positions, scoring adapters, and replacement-baseline helpers.
- `apps/web/app/api/v1/draft-sessions/[id]/recommendations`
- `packages/data-access/`: `RecommendationSnapshot` persistence.

**Tests to Write:**
- `vorp-baseline-calculation`
- `ineligible-players-excluded`
- `tier-drop-factor-generation`
- `roster-fit-respects-hard-slot-requirements`
- `confidence-lowers-when-candidates-are-close`
- `recommendation-snapshot-reproducibility`

**Steps:**
1. Build explicit engine inputs from session, teams, picks, scoring rules, and pinned datasets.
2. Calculate replacement baselines, VORP, tiers, scarcity, roster fit, and risk penalties.
3. Normalize factors and compute total score with versioned weights.
4. Persist immutable recommendation snapshots with input and result payloads.
5. Expose latest snapshot reads through the API.

**Acceptance Criteria:**
- [ ] Recommendation logic is pure from explicit inputs.
- [ ] Every recommendation returns raw and normalized factors, score, and confidence.
- [ ] Recommendation snapshots can be regenerated from stored versions and inputs.

---

### Phase 1.4: Simulation and Recommendation Orchestration

**Objective:** Add next-pick availability simulation without blocking the interactive draft experience.

**Files to Modify/Create:**
- `packages/simulation/`: deterministic seeds, opponent profiles, ADP distributions, summary output.
- `packages/events/` or job handlers: simulation dispatch and cache lookup.
- `apps/web/app/api/v1/draft-sessions/[id]/simulations`
- `apps/web/app/api/v1/ws` and gateway infrastructure.

**Tests to Write:**
- `simulation-seed-reproducibility`
- `availability-summary-shape`
- `preliminary-ranking-served-before-simulation`
- `stale-simulation-summary-not-applied`
- `websocket-recommendation-versioning`

**Steps:**
1. Define candidate set selection for simulation input.
2. Implement opponent utility sampling using ADP, value, need, and randomness.
3. Run bounded trial batches with deterministic seeding.
4. Cache and persist aggregate summaries, not full draft traces.
5. Publish preliminary deterministic recommendations, then update with simulation-enriched snapshots.
6. Broadcast versioned draft and recommendation updates over WebSocket.

**Acceptance Criteria:**
- [ ] Simulation enriches recommendations without becoming a hard dependency for interactivity.
- [ ] Cached or completed simulation summaries are version-scoped and discardable when stale.
- [ ] Clients can subscribe and stay synchronized using session versions.

---

### Phase 1.5: AI Explanations and Frontend Integration

**Objective:** Connect the prepared UI shells to live recommendation and explanation services and finish the MVP interaction loop.

**Files to Modify/Create:**
- `apps/web/features/draft/`: bind board, roster, recommendation, explanation, sync-status, and stale-data shells to live API and WebSocket data.
- `apps/web/app/api/v1/draft-sessions/[id]/recommendations/explanation`
- `packages/ai/`: prompt templates, schema validation, fallback templates, telemetry.
- `packages/events/` or app telemetry: explanation request metrics.

**Tests to Write:**
- `explanation-schema-validation`
- `ai-timeout-falls-back-to-template`
- `ui-renders-server-authoritative-recommendations`
- `websocket-ui-state-integration`
- `request-rate-limit-on-explanations`

**Steps:**
1. Bind the Phase 0.5 feature shells to authoritative API responses and versioned WebSocket updates.
2. Create the structured explanation request DTO from saved recommendation snapshots.
3. Validate model responses against a strict schema and redact unsupported claims.
4. Add caching, retries, rate limiting, and deterministic fallback explanations.
5. Surface freshness, uncertainty, degraded-mode states, and simulation/explanation status in the UI.

**Acceptance Criteria:**
- [ ] Users can complete a live mock draft and see recommendations update after each pick.
- [ ] Explanation requests never alter recommendation results.
- [ ] Frontend integration preserves the server-authoritative product model and degraded-mode handling.

## Open Questions

1. Should the first live-board sync path rely on polling only or polling plus WebSocket from the start?
   - **Option A:** Polling only, add WebSocket later.
   - **Option B:** Polling for provider refresh plus WebSocket for internal session updates.
   - **Recommendation:** Option B. The docs already separate upstream snapshot refreshes from first-party event propagation, and Phase 1 needs a responsive draft board.

2. How many candidates should simulation evaluate initially?
   - **Option A:** Entire draftable player pool.
   - **Option B:** A bounded top-N candidate set from the deterministic pre-simulation ranking.
   - **Recommendation:** Option B. It is faster, cheaper, and aligned with the UI’s actual recommendation list.

## Risks & Mitigation

- **Risk:** Recommendation logic becomes entangled with transport or database details.
  - **Mitigation:** Build engine inputs in application services and keep scoring pure.
- **Risk:** Simulation latency degrades draft responsiveness.
  - **Mitigation:** Publish preliminary rankings, cap trials, and cache by version/configuration.
- **Risk:** Sleeper snapshot freshness issues confuse users.
  - **Mitigation:** Show freshness state clearly and preserve the validated manual-pick fallback.
- **Risk:** AI explanations hallucinate unsupported claims.
  - **Mitigation:** Strict input DTOs, schema validation, instruction constraints, and deterministic fallback templates.

## Success Criteria

- [ ] Users can import a Sleeper league and create a draft session.
- [ ] Picks, undo, and session synchronization work with version safety.
- [ ] Deterministic recommendations and simulation updates are persisted and displayed.
- [ ] AI explanations are available but non-authoritative.
- [ ] The MVP milestone in the roadmap is met end to end.

## Notes for Atlas

Preserve the MVP scope. Avoid adding multi-user strategy editing, custom scoring builders, chat interfaces, or non-Sleeper integrations in this phase. The critical handoff artifact is a stable, reproducible recommendation pipeline tied to a live session flow and connected into the frontend shells defined in Phase 0.5.