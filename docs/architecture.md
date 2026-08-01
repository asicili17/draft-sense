# DraftSense Architecture

## Purpose

DraftSense is a real-time draft decision system. Its recommendation engine and simulations make deterministic, reproducible decisions; OpenAI only turns their structured results into concise explanations. The initial product supports fantasy football, while every domain boundary accepts a sport and scoring-format context so other sports can be added without rewriting the platform.

## Component diagram

```text
Browser (Next.js, Tailwind, shadcn/ui)
  ├─ Draft board and roster state
  ├─ Recommendation and explanation views
  └─ WebSocket client
             │ HTTPS / WebSocket
             ▼
Next.js application
  ├─ REST route handlers / authentication
  ├─ Draft session service
  ├─ Recommendation orchestration service
  ├─ Simulation worker dispatcher
  └─ WebSocket gateway
       │              │                 │
       ▼              ▼                 ▼
 PostgreSQL        Redis            Worker processes
 source of truth   cache, queues    simulations, projections import
       │                                  │
       └────────── Recommendation engine ─┘
                              │
                              ▼
                    OpenAI Responses API
                    (explanations only)
```

## Responsibilities

The frontend renders authoritative server state, collects draft actions, and displays recommendation changes. It must not calculate rankings, scarcity, or availability. Optimistic UI is limited to a pending pick indicator; the server-confirmed event is authoritative.

The backend validates draft order and roster rules, persists immutable draft events, computes recommendations, runs simulations, and publishes updates. Domain services are independent of HTTP and WebSocket transport. Workers perform CPU-intensive simulation and ingestion work outside the request lifecycle.

## Event-driven draft flow

1. A client submits a pick with the expected session version.
2. The draft service validates it transactionally, writes a `DraftPick`, increments the session version, and records an outbox event.
3. An outbox publisher places `draft.pick.recorded` on Redis Streams (or a queue).
4. Recommendation workers invalidate affected cache entries, run the decision pipeline and, when required, simulations.
5. The gateway broadcasts `draft.updated` and `recommendations.updated` to the session channel.

The outbox prevents a committed pick from being lost when publishing fails. Consumers are idempotent using the event ID and session version. Recommendation payloads include the version that produced them, so clients discard stale messages.

## Data flow and consistency

Postgres is the system of record for users, leagues, configurations, players, projections, sessions, picks, and saved recommendation snapshots. Redis holds ephemeral presence, rate-limit counters, cached recommendation results, queue/stream state, and short-lived simulation results. A cache miss is always recomputed from Postgres data and versioned configuration. Never make Redis the only store for a pick or draft result.

Projection imports create immutable dataset versions. A session pins a dataset version, preserving reproducibility even as new projections arrive. Every recommendation persists its input versions, algorithm version, and score breakdown for auditability.

## Technology choices

| Choice | Rationale |
| --- | --- |
| Next.js + TypeScript | One typed full-stack application, React UI, route handlers, and server rendering. |
| PostgreSQL + Prisma | Relational integrity for draft state, migrations, and a type-safe data layer. |
| Redis | Low-latency cache, pub/sub or streams, queues, presence, and rate limiting. |
| Tailwind + shadcn/ui | Accessible, composable interface primitives with project-owned styling. |
| OpenAI Responses API | Structured explanation generation and tool calls without making it a decision authority. |

Use a modular monolith initially: packages/modules have explicit interfaces, but deploy together. Extract workers or sport-specific services only when load, ownership, or independent release cadence requires it.

