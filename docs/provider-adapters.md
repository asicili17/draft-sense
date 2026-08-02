# Provider Adapter Architecture

## Purpose

DraftSense must not depend on Sleeper, MySportsFeeds, Fantasy Football Calculator, or any other provider's response shape, identifiers, rate limits, or SDK. The application and recommendation engine consume DraftSense-owned contracts only. Provider changes are isolated to adapters and the composition root.

## Initial provider responsibilities

| DraftSense need                                | Initial adapter                        | Replaceable by                            |
| ---------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| League import, scoring, roster and draft state | `SleeperLeagueProvider`                | A future Yahoo or other platform provider |
| NFL player metadata and projected stat lines   | `MySportsFeedsProjectionProvider`      | Any licensed projection provider          |
| ADP by scoring format and league size          | `FantasyFootballCalculatorAdpProvider` | Any permitted ADP provider                |

The source of an individual fact is explicit. A projection adapter must not silently provide ADP, and an ADP adapter must not silently provide projections.

## Application ports

Define these interfaces in an application-owned `providers` module. They return normalized, validated values; no provider-specific JSON escapes this boundary.

```ts
interface LeaguePlatformProvider {
  findLeagues(input: { username: string; season: number }): Promise<ExternalLeague[]>;
  getLeagueSnapshot(input: { leagueId: string }): Promise<LeagueSnapshot>;
  getDraftSnapshot(input: { draftId: string }): Promise<DraftSnapshot>;
}

interface ProjectionProvider {
  getProjections(input: ProjectionRequest): Promise<ProjectionImport>;
}

interface AdpProvider {
  getAdp(input: AdpRequest): Promise<AdpImport>;
}
```

`LeagueSnapshot`, `DraftSnapshot`, `ProjectionImport`, and `AdpImport` are DraftSense types. Each import includes `source`, `retrievedAt`, `sourceVersion?`, and an immutable raw-payload hash for traceability.

## Normalization rules

- Maintain DraftSense `Player` as the canonical identity. Store every provider's player ID in a dedicated external-identity mapping, never in recommendation logic.
- Match a new provider identity first by its known external IDs, then by a reviewed name/team/position match. Ambiguous matches are quarantined for review rather than guessed.
- Preserve projected _stat lines_ and calculate fantasy points with the imported Sleeper scoring rules. This makes the same source work for PPR, half-PPR, superflex, and custom leagues.
- Store provider-specific fields only under typed adapter metadata. Do not add MySportsFeeds or Sleeper fields to generic domain entities.
- Persist every successful ADP and projection import as an immutable dataset version. A draft session pins exact versions.

## Failure behavior

Provider calls occur in background refresh jobs, never in a recommendation request or the draft-pick transaction. Each adapter maps upstream failures to provider-neutral errors (`UNAVAILABLE`, `RATE_LIMITED`, `INVALID_RESPONSE`, `AUTHENTICATION_FAILED`). The application retains the last successful dataset and displays its freshness rather than blocking the draft.

## Composition

The server composition root selects adapters through configuration:

```text
LeaguePlatformProvider = SleeperLeagueProvider
ProjectionProvider     = MySportsFeedsProjectionProvider
AdpProvider            = FantasyFootballCalculatorAdpProvider
```

Replacing a provider changes the adapter implementation, its configuration, and its contract tests—not the UI, draft engine, recommendation engine, database-facing application services, or persisted generic dataset schema.

## Testing

Each adapter has recorded provider-response fixtures and contract tests for normalization, pagination, missing fields, rate-limit errors, and ID matching. Application-service tests use fake port implementations. No test outside an adapter imports a provider SDK or fixture.
