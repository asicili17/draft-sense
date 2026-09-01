# Database Schema

## Prisma model outline

The following is a model outline, not implementation code. IDs are UUIDs; timestamps are UTC. Use enums for `Sport`, `DraftType`, `DraftStatus`, `Position`, and `PickSource`.

| Model                    | Key fields and relationships                                                                                       | Purpose                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `User`                   | `id`, `email`, `displayName`; has many `League`, `DraftSession`                                                    | Account ownership and identity.                                                                 |
| `League`                 | `id`, `ownerId`, `sport`, `name`; has many `DraftSession`                                                          | Private league context owned by the importing user.                                             |
| `LeagueIntegration`      | `leagueId`, `provider`, `externalLeagueId`, `externalDraftId?`, `lastSyncedAt`                                     | Link to a league platform; unique `(provider, externalLeagueId)`.                               |
| `ScoringFormat`          | `id`, `sport`, `name`, `rules Json`, `version`                                                                     | Versioned scoring and roster rules.                                                             |
| `Player`                 | `id`, `sport`, identity fields, `positions`                                                                        | Canonical player identity owned by DraftSense.                                                  |
| `PlayerExternalIdentity` | `playerId`, `provider`, `externalId`, `metadata Json`                                                              | Provider-specific player mapping; unique `(provider, externalId)`.                              |
| `ProjectionDataset`      | `id`, `sport`, `source`, `version`, `publishedAt`                                                                  | Immutable import batch and provenance.                                                          |
| `ProviderImport`         | `id`, `provider`, `kind`, `retrievedAt`, `status`, `payloadHash`, `diagnostics Json`                               | Auditable result of an external import; links to published datasets when successful.            |
| `PlayerProjection`       | `datasetId`, `playerId`, `scoringFormatId`, `projectedPoints`, `adp`, `risk`, `metadata Json`                      | Dataset-specific player forecast.                                                               |
| `DraftSession`           | `id`, `leagueId?`, `ownerId`, `sport`, `status`, `draftType`, `teamCount`, `settings Json`, `datasetId`, `version` | A versioned live draft aggregate.                                                               |
| `DraftTeam`              | `sessionId`, `slot`, `name`                                                                                         | One drafting entity in the imported league.                                                     |
| `UserDraftTeamSelection` | `userId`, `sessionId`, `teamId`                                                                                    | The owner's selected roster, used for recommendations and manual picks.                         |
| `DraftPick`              | `sessionId`, `overallPick`, `round`, `teamId`, `playerId`, `source`, `createdAt`                                   | Immutable selected player event; unique `(sessionId, overallPick)` and `(sessionId, playerId)`. |
| `RecommendationSnapshot` | `sessionId`, `version`, `algorithmVersion`, `input Json`, `results Json`                                           | Auditable deterministic output, unique `(sessionId, version, algorithmVersion)`.                |
| `SimulationRun`          | `sessionId`, `version`, `config Json`, `summary Json`, `status`                                                    | Persisted reproducibility metadata and aggregated results.                                      |
| `OutboxEvent`            | aggregate ID/version, `type`, `payload Json`, `publishedAt`                                                        | Transactional event publication.                                                                |

Foreign keys use restrictive deletion for draft history and cascading deletion only for dependent, non-audit configuration data. Add indexes for league integrations, player external identity, active session status, picks by session/overall pick, projections by dataset/player, and snapshots by session/version.

## Relationships

A user owns private leagues and sessions. A session has draft teams, picks, recommendation snapshots, simulation runs, and one selected team for its owner; it pins one projection dataset. A player has many provider identities and projections, and can be selected in many historical sessions, but only once in a given session. A scoring format applies to many projections and sessions.

## Postgres versus Redis

Postgres stores durable business records, immutable history, versioned data, authorization relationships, and all data needed to regenerate recommendations. JSON fields are for provider-specific rules and score breakdowns; queryable fields remain normalized columns.

Redis stores only rebuildable, expiring state: `session:{id}:recommendations:{version}`, simulation summaries, WebSocket presence, distributed locks, rate-limit counters, idempotency keys, and stream/queue messages. Set explicit TTLs and use key prefixes. Persist completed simulation summaries and recommendation snapshots to Postgres before eviction can matter.
