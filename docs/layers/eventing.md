# Eventing and Real-Time Layer

## Responsibility

This layer distributes durable draft changes and derived updates. It contains the transactional outbox publisher, Redis Stream/queue adapter, idempotent consumers, and WebSocket gateway. It does not validate picks or calculate recommendation scores.

## Outbox lifecycle

The application transaction records an event with aggregate ID, aggregate version, type, payload, and unpublished status beside the draft change. A publisher claims unpublished rows, sends them to the stream, and records delivery. Retried publishing is safe because consumer processing is idempotent by event ID and session version.

Primary events include `draft.pick.recorded`, `draft.pick.undone`, `recommendations.computed`, and `simulation.completed`. Event schemas are versioned and additive; consumers tolerate unknown fields and use a dead-letter path for repeatedly failing messages.

## WebSocket delivery

The gateway authorizes subscriptions by session membership, maps internal events to public contracts, and publishes `draft.updated`, `recommendations.updated`, and `simulation.updated`. Payloads include `sessionId`, `sessionVersion`, and correlation ID. The gateway provides at-least-once delivery; clients deduplicate by version and REST refetch after a discontinuity.

## Operational requirements

Monitor outbox lag, consumer lag, dead letters, broadcast failures, connection counts, and reconnect rate. Bound payload size and channel fan-out. Never publish sensitive fields merely because they exist in an internal event.
