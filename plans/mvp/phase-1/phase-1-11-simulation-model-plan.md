# Plan: Phase 1.11 Simulation Model and Availability Quality

**Created:** 2026-08-03
**Status:** Ready for Atlas Execution

## Summary

Phase 1.11 replaces the MVP’s simple candidate-pressure calculation with a reproducible, roster-aware draft simulation. It models opponent choices, ADP distributions, and future roster value while remaining asynchronous and non-blocking.

## Context & Analysis

**Relevant Files:**
- `docs/simulation-design.md`: required Monte Carlo model and performance constraints.
- `packages/simulation/src/index.ts`: current deterministic availability calculation.
- `packages/recommendation/`: candidate ranking and factor contracts.
- `packages/data-access/prisma/schema.prisma`: simulation persistence.

**Key Functions/Classes:**
- `runSimulation()` in `packages/simulation/`.
- `recommend()` in `packages/recommendation/`.
- Worker handlers introduced in Phase 1.8.

**Dependencies:**
- Phase 1.7 selected user team and roster identity.
- Phase 1.8 worker runtime and versioned dispatch.
- Pinned projection and ADP dataset fields sufficient for simulation input.

**Patterns & Conventions:**
- Simulations receive complete immutable input and a deterministic seed.
- Aggregate summaries, not full traces, are persisted.
- Results augment deterministic rankings but never prevent preliminary recommendations.

## Implementation Phases

### Phase 1.11.1: Immutable Simulation Inputs and Opponent Model

**Objective:** Model credible opponent selection behavior without relying on live external state.

**Files to Modify/Create:**
- `packages/simulation/`: profiles, ADP distributions, utility sampling, input/output contracts.
- `packages/data-access/`: persisted simulation configuration/profile defaults if needed.
- `packages/recommendation/`: tier and candidate-set handoff.

**Tests to Write:**
- `simulation-seed-reproducibility`
- `opponent-need-changes-selection-distribution`
- `drafted-players-are-never-selected`
- `adp-distribution-is-bounded`

**Steps:**
1. Define explicit candidate, roster, team, and profile inputs.
2. Represent ADP as a bounded distribution, not a fixed rank.
3. Compute opponent utility from ADP, value, tier, need, and seeded randomness.
4. Sample picks from weighted utilities rather than always selecting the highest value.
5. Exclude drafted/ineligible players and update simulated rosters each turn.

**Acceptance Criteria:**
- [ ] Identical inputs and seeds produce identical aggregate output.
- [ ] Opponent teams do not draft unavailable or illegal players.
- [ ] Profiles create meaningful but bounded draft variation.

---

### Phase 1.11.2: Availability and Decision Summaries

**Objective:** Quantify waiting risk and expected future roster value for top candidate decisions.

**Files to Modify/Create:**
- `packages/simulation/`: trial batching, availability, expected value, and downside summaries.
- `packages/recommendation/`: simulation-enriched factor merge.
- `apps/web/app/api/v1/draft-sessions/[id]/simulations`: status/result contract.
- `apps/web/components/draft-assistant.tsx`: availability and stale/degraded presentation.

**Tests to Write:**
- `availability-summary-shape`
- `candidate-waiting-value-is-reproducible`
- `preliminary-ranking-served-before-simulation`
- `stale-simulation-summary-not-applied`

**Steps:**
1. Simulate the next meaningful user pick window for a bounded top-N set.
2. Aggregate availability, expected roster value, and downside percentiles.
3. Persist config, seed, session version, and aggregate outputs.
4. Enrich matching recommendation snapshots only when versions match.
5. Clearly label preliminary, complete, and stale simulation states in the UI.

**Acceptance Criteria:**
- [ ] The user can understand availability risk for top candidates.
- [ ] Simulations update recommendations only for their originating version.
- [ ] The interactive draft workflow remains responsive during simulation.

## Open Questions

1. What trial budget should the initial worker use?
   - **Option A:** Fixed 1,000 trials.
   - **Option B:** Adaptive trials based on candidate separation.
   - **Recommendation:** Option A initially; introduce adaptive budgets only after measuring worker latency.

## Risks & Mitigation

- **Risk:** Simulation results appear more certain than inputs justify.
  - **Mitigation:** Present uncertainty and use simulations as one factor, not a verdict.
- **Risk:** Trial cost grows with player-pool size.
  - **Mitigation:** Restrict to top-N candidates, compact arrays, and bounded worker budgets.

## Success Criteria

- [ ] Availability estimates are reproducible, roster-aware, and version-safe.
- [ ] Simulation is a background enhancement rather than an interactive dependency.

## Notes for Atlas

Keep the model NFL-specific where needed, but do not leak sport assumptions into generic draft event semantics.
