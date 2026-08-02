# Domain Layer

## Responsibility

The domain layer expresses sport-neutral draft concepts and deterministic rules: sessions, teams, draft order, picks, roster eligibility, scoring formats, projections, recommendation factors, and simulation contracts. Sport modules supply position and scoring policies through explicit interfaces.

## Invariants

- A player is selected at most once per session.
- A pick must match the current overall selection and authorized team.
- Draft changes advance the session version.
- Roster constraints and sport eligibility are enforced before recommendation scoring.
- Recommendation results identify every input, configuration, and algorithm version.

The recommendation engine is a pure calculation over explicit data. Its VORP, tier drop, scarcity, roster-fit, risk, and availability factors are inspectable. The simulation engine uses explicit seeds/configuration and produces deterministic results for identical inputs.

## Allowed dependencies

The domain depends only on TypeScript language/runtime primitives and carefully selected pure utilities. It does not import Next.js, Prisma, Redis, OpenAI, transport schemas, clocks, random generators, or provider SDKs. It accepts these concerns as data or ports.

## Extension

New sports implement sport policies for player eligibility, roster construction, scoring, projection translation, and opponent defaults. They do not alter generic draft event semantics. This preserves a stable core while allowing football-specific rules to evolve independently.

