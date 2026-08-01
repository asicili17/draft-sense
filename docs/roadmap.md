# DraftSense Roadmap

## Phase 0: design and foundations

- Approve these documents and define football scoring presets, roster rules, and supported draft types.
- Establish the monorepo/module layout, CI, environment management, migrations, observability, and seed datasets.
- Define projection-provider contracts and dataset versioning.

**Milestone:** a reproducible local environment can load a versioned player dataset.

## Phase 1: MVP draft assistant

- Account and league creation, snake-draft configuration, and a live draft board.
- Manual pick entry with server-side pick-order and roster validation.
- Football player/projection import, deterministic tiers and value-over-replacement rankings.
- Recommendation engine with roster-aware top recommendations and score breakdown.
- WebSocket updates for connected participants.
- Monte Carlo availability estimates for the next meaningful pick window.
- OpenAI explanation for a selected structured recommendation.

**MVP scope:** one sport (NFL), curated scoring presets, manual drafts, a single projection dataset per session, and recommendations for one user-managed roster. The product does not need a chat interface, automated drafting, trade advice, or a mobile native app.

**Milestone:** users can complete a live mock draft and see recommendations update after every pick.

## Phase 2: reliability and decision quality

- Multiple projection sources, consensus and source comparison.
- Background recomputation, warm caches, load tests, metrics, tracing, and alerting.
- Draft import/export, reconnect recovery, shared league sessions, and audit history.
- Explainability views showing tiers, scarcity, need, availability, and alternatives.
- Evaluation harness using historical ADP and draft scenarios.

**Milestone:** recommendation latency and quality meet defined product SLOs under concurrent drafts.

## Phase 3: product expansion

- Auction drafts, custom scoring, keeper/dynasty rules, and personalized risk preferences.
- Player news ingestion with cited retrieval for explanations.
- Additional sports via sport adapters and sport-specific scoring/roster modules.
- Subscription, league invitations, commissioner controls, and analytics.

## Stretch goals

- Draft-platform integrations where permitted.
- What-if pick comparison and counterfactual draft paths.
- Offline-friendly draft-board experience.
- Ensemble projections and user-adjustable strategy profiles.

## Future enhancements

Add model calibration from outcomes only after preserving historical inputs and recommendation decisions. Support salary caps, trades, IDP, best ball, and multi-league portfolio optimization through extensions rather than changing core draft event semantics.

