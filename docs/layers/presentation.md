# Presentation Layer

## Responsibility

The Next.js presentation layer renders draft state and recommendation results, accepts user intent, and maintains a responsive connection to live updates. It uses TypeScript, Tailwind, and shadcn/ui. It is not a decision engine and must not calculate rankings, tiers, roster legality, or simulation results.

## Boundaries

Feature modules own screens and local interaction state for draft boards, player search, roster views, recommendations, and explanations. Shared components provide accessible primitives and must not call application APIs directly. Client API modules are the only browser-facing boundary for REST and WebSocket contracts.

The server-confirmed session version is authoritative. A pending pick may be displayed optimistically, but the UI reconciles it only after `draft.updated`; stale WebSocket messages are ignored and version gaps cause a refetch.

## Interfaces

- REST query/mutation contracts from [../api-design.md](../api-design.md).
- WebSocket subscriptions scoped to an authorized `draft:{sessionId}` channel.
- View models derived from recommendation snapshots, not engine internals.

## Constraints

Keep credentials, Prisma, Redis, OpenAI, and business-rule modules server-only. Validate forms locally for usability and rely on server validation for correctness. Render explanation content as data, never executable markup. Capture client errors and connection status with request/session IDs for diagnostics.
