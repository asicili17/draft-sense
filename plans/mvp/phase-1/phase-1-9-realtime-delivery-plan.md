# Plan: Phase 1.9 Real-Time Draft Delivery

**Created:** 2026-08-03
**Status:** Ready for Atlas Execution

## Summary

Phase 1.9 adds authenticated, versioned real-time draft updates on top of the durable event pipeline. Clients retain polling/refetch recovery, while WebSocket delivery improves responsiveness without becoming an authoritative data source.

## Context & Analysis

**Relevant Files:**
- `docs/api-design.md`: WebSocket event names and version-gap behavior.
- `docs/layers/eventing.md`: gateway and broadcast constraints.
- `apps/web/components/draft-assistant.tsx`: current polling-based client state.
- `packages/events/`: outbox and queue work introduced by Phase 1.8.

**Key Functions/Classes:**
- `draft.updated`, `recommendations.updated`, and `simulation.updated` event contracts.
- Session GET and recommendation GET routes used for refetch recovery.

**Dependencies:**
- Phase 1.7 authenticated membership and selected team.
- Phase 1.8 durable event publisher and worker results.
- A deployment-compatible WebSocket gateway/pub-sub provider.

**Patterns & Conventions:**
- A message only hints that durable state changed; the client refetches authoritative APIs.
- Client applies only newer session versions and refetches after version gaps.
- Subscription authorization happens before joining a session channel.

## Implementation Phases

### Phase 1.9.1: Gateway and Event Contracts

**Objective:** Publish authorized, minimal draft update messages to session subscribers.

**Files to Modify/Create:**
- `packages/events/`: gateway port, broadcast adapter, and public event DTOs.
- `apps/web/app/api/v1/ws` or gateway service: connection/subscription endpoint.
- `apps/web/server/auth/`: WebSocket token verification and membership check.

**Tests to Write:**
- `unauthorized-subscription-rejected`
- `draft-update-payload-is-versioned`
- `event-payload-excludes-provider-secrets`

**Steps:**
1. Choose gateway hosting compatible with the web deployment.
2. Implement authenticated connection setup and `draft:{sessionId}` subscription.
3. Validate membership before channel join.
4. Map committed/worker events to minimal public payloads.
5. Add connection, fan-out, and broadcast-failure metrics.

**Acceptance Criteria:**
- [ ] Only authorized users can subscribe to a draft channel.
- [ ] Messages include session ID and session version.
- [ ] Provider metadata and private user data are never broadcast.

---

### Phase 1.9.2: Client Reconciliation

**Objective:** Keep the board responsive while preserving server authority and recovery behavior.

**Files to Modify/Create:**
- `apps/web/features/draft/` or `apps/web/components/draft-assistant.tsx`: socket client and state reconciliation.
- Client API module: refetch/reconnect helpers.

**Tests to Write:**
- `client-ignores-stale-version`
- `client-refetches-on-version-gap`
- `polling-remains-fallback-when-socket-disconnects`

**Steps:**
1. Subscribe after loading an authorized session.
2. Refetch session/recommendation data after newer events.
3. Ignore duplicate or stale messages.
4. Reconnect with backoff and refetch on gaps.
5. Keep bounded polling as a fallback for gateway outages.

**Acceptance Criteria:**
- [ ] A pick updates connected boards without waiting for the polling interval.
- [ ] Disconnects recover to current server state.
- [ ] Real-time delivery cannot create divergent client draft state.

## Open Questions

1. Should the gateway be self-hosted or managed?
   - **Option A:** Managed real-time provider.
   - **Option B:** Dedicated self-hosted WebSocket service.
   - **Recommendation:** Option A for the MVP if it supports authenticated private channels and observability.

## Risks & Mitigation

- **Risk:** WebSocket state drifts from the database.
  - **Mitigation:** Broadcast versions only and refetch authoritative resources.
- **Risk:** Serverless deployment does not support persistent connections.
  - **Mitigation:** Use a managed gateway or separate service; do not emulate WebSockets in a standard route handler.

## Success Criteria

- [ ] Connected, authorized clients receive timely versioned updates.
- [ ] Polling safely covers gateway downtime and reconnects.

## Notes for Atlas

Retain the polling path until real-time monitoring demonstrates a stable gateway. Do not send full recommendation or session payloads unless profile data supports it.
