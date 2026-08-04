# Plan: Phase 1.10 AI Explanation Operations

**Created:** 2026-08-03
**Status:** Ready for Atlas Execution

## Summary

Phase 1.10 turns the MVP explanation endpoint into a bounded, observable AI adapter. It moves explanation generation into `packages/ai`, adds durable caching and rate limiting, and strengthens schema, fallback, and telemetry behavior without allowing AI to influence rankings.

## Context & Analysis

**Relevant Files:**
- `docs/ai-integration.md`: explanation-only AI boundary.
- `docs/layers/ai.md`: adapter, cache, and telemetry expectations.
- `apps/web/app/api/v1/draft-sessions/[id]/recommendations/explanation/route.ts`: current route-level implementation.
- `packages/recommendation/`: immutable snapshot factor payloads.

**Key Functions/Classes:**
- `generateExplanation()` in new `packages/ai/`.
- Recommendation snapshot repository methods in `packages/data-access/`.

**Dependencies:**
- Phase 1.6 migration/testing foundation.
- A durable cache/rate-limit store, normally Redis.
- Configured OpenAI credentials in runtime environments.

**Patterns & Conventions:**
- AI receives only a saved snapshot DTO, never mutable draft state.
- All model output is untrusted until validated against a strict schema.
- Model failure degrades to deterministic copy and does not delay picks or rankings.

## Implementation Phases

### Phase 1.10.1: Dedicated AI Adapter

**Objective:** Move provider-specific explanation work behind a typed, testable package boundary.

**Files to Modify/Create:**
- `packages/ai/`: prompt version, DTOs, OpenAI adapter, schema, fallback templates.
- `apps/web/app/api/v1/draft-sessions/[id]/recommendations/explanation/route.ts`: thin authorization/DTO route.
- `apps/web/server/env.ts`: validated AI runtime configuration.

**Tests to Write:**
- `explanation-schema-validation`
- `unsupported-claim-is-rejected`
- `ai-timeout-falls-back-to-template`
- `ranking-is-unchanged-when-ai-fails`

**Steps:**
1. Define the minimal snapshot-derived explanation DTO.
2. Version the system prompt and response schema.
3. Implement the OpenAI Responses adapter with timeout and retry policy.
4. Validate and sanitize output before returning it.
5. Preserve a deterministic template fallback for every failure mode.

**Acceptance Criteria:**
- [ ] The route contains no prompt or provider implementation details.
- [ ] Invalid, timed-out, or unavailable model responses return a safe template.
- [ ] The AI adapter cannot invoke recommendation or pick mutation code.

---

### Phase 1.10.2: Durable Limits, Cache, and Telemetry

**Objective:** Control cost and observe explanation quality across processes and deployments.

**Files to Modify/Create:**
- `packages/ai/`: cache keys, limit port, telemetry contracts.
- `packages/data-access/` or cache adapter: durable/redactable telemetry persistence.
- `apps/web/server/`: Redis/cache composition.

**Tests to Write:**
- `explanation-cache-hit-by-snapshot-and-prompt-version`
- `rate-limit-is-shared-across-instances`
- `telemetry-redacts-prompt-secrets`

**Steps:**
1. Cache by snapshot ID and prompt version.
2. Replace in-memory rate limiting with a shared TTL-backed limit.
3. Record model, prompt version, latency, fallback status, and redacted request/output metadata.
4. Add bounded retry/backoff only for transient provider failures.
5. Expose metrics for cache hit rate, errors, latency, and fallback rate.

**Acceptance Criteria:**
- [ ] Repeated requests do not duplicate model calls unnecessarily.
- [ ] Limits work across multiple web instances.
- [ ] Telemetry supports cost/quality analysis without storing sensitive provider data.

## Open Questions

1. Should explanation outputs be persisted beyond cache TTL?
   - **Option A:** Cache only.
   - **Option B:** Persist redacted result metadata and rendered response.
   - **Recommendation:** Option B for evaluation, with a defined retention policy.

## Risks & Mitigation

- **Risk:** Prompt/model changes invalidate historical comparisons.
  - **Mitigation:** Version both prompt and model metadata with every result.
- **Risk:** AI output makes unsupported player claims.
  - **Mitigation:** Supply facts only, validate structure, and fall back when output is invalid.

## Success Criteria

- [ ] Explanations are reliable, bounded, and observable.
- [ ] AI remains strictly non-authoritative.

## Notes for Atlas

Do not add news retrieval or chat in this phase. They are later product-expansion work.
