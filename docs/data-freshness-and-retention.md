# Data Freshness and Retention

## Scope

This policy governs DraftSense-owned normalized records and provider-originated data. Provider contracts and licenses take precedence; this document must be updated before changing a provider or product distribution model.

## Freshness targets

| Data                                                         | Refresh policy                                                                                     | Recommendation behavior when stale                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Sleeper draft picks and configuration during an active draft | Poll according to `LIVE_DRAFT_POLL_SECONDS`; immediately refresh after an explicit user refresh.   | Do not make a new recommendation from a board older than two polling intervals; return the last version with a stale-board indicator. |
| Sleeper player catalogue                                     | Daily cached import; never on a recommendation request.                                            | Use the last successful version and flag catalogue freshness.                                                                         |
| FantasyPros preseason projections and consensus              | Scheduled daily before and during draft season; immutable version per successful import.           | Use the last successful complete dataset; lower confidence after 36 hours.                                                            |
| FantasyPros injury/news data                                 | Scheduled no more often than the licensed rate limit permits; version separately from projections. | Do not block a recommendation. Omit stale risk adjustments and disclose their timestamp.                                              |

No provider request is allowed in the live recommendation transaction. A session pins a provider dataset/version; a refresh creates a new dataset and recomputes a new recommendation snapshot.

## Retention and provenance

- Store source, provider timestamp, retrieval timestamp, source/version identifier, normalized payload hash, scoring format, and algorithm version with every immutable dataset and recommendation snapshot.
- Store raw stat-line projections only as long as the provider agreement permits. Never store or display player images unless explicitly licensed.
- Retain recommendation inputs/results for reproducibility and quality analysis. Delete or anonymize user/account data according to the product privacy policy; do not make provider data a proxy for user data.
- Historical datasets and bulk backtest archives require explicit confirmation that the provider license permits retention and the intended use. They are disabled by default.
- Do not redistribute raw provider payloads. Public explanations show DraftSense-derived factors, sources, and timestamps, not bulk provider fields.

## Licensing operational gate

Before production/public or paid use of a provider dataset, record the applicable commercial agreement, permitted display/redistribution rights, rate limit, retention period, attribution language, and termination obligations in deployment configuration and provider runbooks. The refresh job must stop using a provider if its credential or license status is not configured for the deployment environment.
