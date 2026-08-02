# Layer Architecture Index

This directory expands the system overview in [../architecture.md](../architecture.md). Each document defines one architectural layer's responsibility, public boundary, allowed dependencies, and operational concerns.

```text
Presentation → Application → Domain
                  │             │
                  ▼             ▼
              Eventing ← Persistence
                  │
                  ▼
                Workers
                  │
                  ▼
             AI explanation
```

Dependencies point inward: presentation depends on application contracts; application orchestrates domain ports; adapters implement ports without leaking their frameworks into domain logic. Workers use the same application/domain contracts as HTTP handlers. The AI layer receives completed recommendation snapshots only.

| Layer | Document | Owns |
| --- | --- | --- |
| Presentation | [presentation.md](presentation.md) | Next.js UI and user interaction |
| Application | [application.md](application.md) | Use cases, authorization, orchestration |
| Domain | [domain.md](domain.md) | Draft rules and deterministic decisions |
| Persistence | [persistence.md](persistence.md) | Prisma/Postgres and Redis adapters |
| Eventing | [eventing.md](eventing.md) | Outbox, streams, WebSocket delivery |
| Workers | [workers.md](workers.md) | Simulations and data ingestion |
| AI | [ai.md](ai.md) | Explanation generation only |

