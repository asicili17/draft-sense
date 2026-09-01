# Persistence Layer

## Responsibility

Persistence adapters implement repository and cache ports. PostgreSQL with Prisma is the durable source of truth; Redis is an explicitly expiring optimization and coordination store. Detailed entities are defined in [../database-schema.md](../database-schema.md).

## PostgreSQL and Prisma

Repositories load and save aggregates without exposing Prisma records outside the adapter. Transactions atomically write `DraftPick`, updated session version, audit snapshot metadata, and `OutboxEvent`. Projection datasets are immutable and sessions pin their input version. Database constraints enforce uniqueness even when concurrent requests bypass application checks.

Migrations are reviewed artifacts, forward-compatible where possible, and exercised against an empty database and representative persisted data. Queries must be indexed by their normal session, player, dataset, and version access paths.

## Redis

Redis keys hold cacheable recommendation/simulation results, rate limits, locks, presence, idempotency records, and stream/queue state. Every key has a documented prefix, ownership, serialization format, and TTL. Cache values include session and algorithm versions; invalidation is an optimization, never a correctness requirement.

## Constraints

Adapters translate database/provider exceptions into typed infrastructure errors and do not decide business policy. No Redis state is required to reconstruct draft history. Connections are managed by the server composition root and instrumented for pool saturation, latency, failures, and cache hit rate.
