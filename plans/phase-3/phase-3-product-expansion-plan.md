# Plan: Phase 3 Product Expansion

**Created:** 2026-08-01
**Status:** Ready for Atlas Execution

## Summary

Phase 3 expands DraftSense beyond the initial NFL Sleeper MVP while preserving the system’s core contract: deterministic draft decisions backed by versioned data and optional AI explanations. This phase covers new draft modes and league rules, additional sports via adapters, player-news retrieval for explanations, personalized preferences, and product/commercial features such as invitations, subscriptions, and analytics. The work should be sequenced so platform-general capabilities are added before product-surface expansion depends on them.

## Context & Analysis

**Relevant Files:**
- `docs/roadmap.md`: defines the Phase 3 feature set.
- `docs/architecture.md`: defines sport-neutral domain boundaries and extension strategy.
- `docs/project-structure.md`: defines `sport-nfl` and future sport adapter boundaries.
- `docs/ai-integration.md`: defines the later cited-retrieval path.
- `docs/provider-adapters.md`: defines swap-friendly provider and external-data abstractions.

**Key Functions/Classes:**
- `SportRulesAdapter`-style contracts in `packages/domain/` and `packages/sport-*`: future sport/rule modules.
- `retrieveExplanationDocuments()` in `packages/ai/` or a retrieval package: bounded, authorized news retrieval.
- `buildUserStrategyProfile()` in recommendation services: configurable risk/preference input.
- Product-account services in `apps/web/server/`: invitations, subscriptions, commissioner controls.

**Dependencies:**
- Stable Phase 2 observability and evaluation harness.
- Strong provider/data versioning from Phases 0 and 1.
- Clear licensing and sourcing policy for news/analysis ingestion.

**Patterns & Conventions:**
- New sports and rules must plug into existing domain interfaces instead of branching core semantics.
- External news remains supplemental explanation context, never ranking authority.
- Personalization may adjust weights or preferences but must preserve hard roster legality and auditable factor breakdowns.

## Implementation Phases

### Phase 3.1: Draft Formats, League Rules, and Strategy Preferences

**Objective:** Expand the core engine to support more formats and user-tunable strategy while preserving deterministic behavior.

**Files to Modify/Create:**
- `packages/domain/`: generalized roster/scoring/draft-type contracts.
- `packages/draft-engine/`: auction or keeper-aware draft mechanics where applicable.
- `packages/recommendation/`: configurable weights, personalized risk preferences, and expanded factor handling.
- `packages/sport-nfl/`: keeper/dynasty/custom scoring support.
- UI and API surfaces for setting and displaying preferences.

**Tests to Write:**
- `custom-scoring-format-compatibility`
- `keeper-rule-enforcement`
- `auction-draft-state-validation`
- `strategy-profile-does-not-break-hard-roster-rules`

**Steps:**
1. Refactor scoring and roster rules into more configurable contracts where Phase 1 assumed curated presets.
2. Add support for keeper/dynasty/custom scoring and, if in scope, auction semantics.
3. Expose user-configurable strategy weights and risk preferences as explicit versioned inputs.
4. Re-run evaluation and regression tests across existing NFL scenarios.

**Acceptance Criteria:**
- [ ] New formats fit the same draft-session and recommendation snapshot model.
- [ ] Personalization is explicit, versioned, and reversible.
- [ ] Existing NFL snake-draft behavior remains stable.

---

### Phase 3.2: Multi-Sport Expansion

**Objective:** Add additional sports without rewriting the core application.

**Files to Modify/Create:**
- `packages/sport-*`: sport-specific scoring, roster rules, positions, projection parsing, and opponent defaults.
- `packages/providers/`: sport-specific provider adapters or adapter branches.
- `packages/recommendation/` and `packages/simulation/`: consume sport-neutral interfaces only.
- UI surfaces for sport-specific display and filtering.

**Tests to Write:**
- `sport-adapter-contract-suite`
- `cross-sport-session-isolation`
- `position-eligibility-by-sport`
- `projection-import-by-sport`

**Steps:**
1. Extract any NFL assumptions still embedded in core packages.
2. Define sport adapter contracts for positions, scoring, roster rules, and projection parsing.
3. Implement one additional sport end to end as the proving case.
4. Validate that route handlers and UI surfaces depend on generic contracts, not sport-specific identifiers.

**Acceptance Criteria:**
- [ ] A new sport can be added through adapters rather than core rewrites.
- [ ] Session, recommendation, and simulation models remain sport-neutral.
- [ ] Sport-specific logic is isolated to dedicated modules.

---

### Phase 3.3: News Retrieval and AI Explanation Enrichment

**Objective:** Add trusted, cited external context to explanations without letting it control rankings.

**Files to Modify/Create:**
- `packages/ai/` or new retrieval package: document ingestion, embedding/indexing, retrieval, source policy, and citation formatting.
- `packages/data-access/`: document metadata and retrieval audit tables if persisted.
- `apps/web/features/recommendation/`: source attribution and freshness display.
- policy/config files for source allowlists and freshness windows.

**Tests to Write:**
- `retrieval-source-allowlist`
- `freshness-window-enforcement`
- `citation-required-for-news-context`
- `prompt-injection-resistant-document-handling`
- `ranking-unchanged-when-news-retrieval-fails`

**Steps:**
1. Define licensed and trusted source allowlists.
2. Ingest documents with source, date, sport/player tags, and embeddings or retrieval indices.
3. Retrieve only relevant, recent, authorized documents for explanation requests.
4. Inject retrieved context into explanation generation as cited supplemental information.
5. Omit retrieval context when freshness, authorization, or confidence checks fail.

**Acceptance Criteria:**
- [ ] News/analysis enriches explanations only.
- [ ] Every retrieved claim is attributable and freshness-checked.
- [ ] Recommendation scoring remains independent of retrieval success.

---

### Phase 3.4: Productization, Access Control, and Commercial Features

**Objective:** Turn the system into a broader product with collaboration, monetization, and operator controls.

**Files to Modify/Create:**
- account, billing, invitations, analytics, and commissioner-control services in `apps/web/server/`.
- UI flows for subscription state, league invitations, and administrative controls.
- telemetry/reporting modules for product analytics and business events.

**Tests to Write:**
- `league-invitation-authorization`
- `subscription-gate-enforcement`
- `commissioner-control-audit-log`
- `analytics-events-do-not-leak-secrets`

**Steps:**
1. Define role and permission models for league collaboration and commissioner actions.
2. Add subscription or plan enforcement aligned with product packaging.
3. Add analytics around engagement, recommendation usage, and retention.
4. Preserve audit logging for privileged operations.
5. Before commercial launch, replace the initial FantasyPros projection source with a paid, explicitly licensed provider and verify rights for API access, caching, storage, display, and redistribution.

**Acceptance Criteria:**
- [ ] Collaboration features respect authorization boundaries.
- [ ] Commercial features do not compromise recommendation reproducibility.
- [ ] Operator and business analytics are structured and privacy-conscious.

## Open Questions

1. Which expansion path should be first after reliability work?
   - **Option A:** Additional draft formats and personalization.
   - **Option B:** Additional sports.
   - **Recommendation:** Option A if the target audience remains NFL-first; Option B only if there is a concrete product need and provider availability. Both require keeping sport-neutral boundaries intact.

2. Should news retrieval ever feed back into recommendation scoring?
   - **Option A:** Yes, as a ranking factor.
   - **Option B:** No, explanation-only unless separately modeled and validated later.
   - **Recommendation:** Option B. It preserves the current trust boundary and prevents unverifiable narrative data from silently changing picks.

## Risks & Mitigation

- **Risk:** Expansion work breaks the clean boundary between explanation context and decision logic.
  - **Mitigation:** Keep news retrieval and AI features explanation-only unless a future validated model is explicitly introduced.
- **Risk:** Supporting too many draft modes or sports introduces pervasive branching in core packages.
  - **Mitigation:** Force new capabilities through sport/rule adapters and contract tests.
- **Risk:** Commercial features create authorization complexity around shared sessions and commissioner powers.
  - **Mitigation:** Add explicit roles, audit logs, and contract tests before exposing privileged actions.

## Success Criteria

- [ ] Expanded formats and preferences fit the existing deterministic engine model.
- [ ] At least one additional expansion axis is delivered without architectural regression.
- [ ] AI retrieval remains cited, bounded, and non-authoritative.
- [ ] Collaboration and product features are auditable and secure.

## Notes for Atlas

Do not attempt all expansion tracks at once. Use the Phase 2 evaluation harness to protect baseline behavior while adding personalization or additional sports. Preserve the product’s central promise: transparent, reproducible recommendations with optional AI explanation layers.
