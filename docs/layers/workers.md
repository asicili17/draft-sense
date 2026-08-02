# Worker Layer

## Responsibility

Workers and scheduled jobs handle work unsuitable for the request path: Sleeper draft polling, projection/ADP ingestion and normalization, Monte Carlo simulation, recommendation recomputation, cache warming, and optional RAG indexing. They consume versioned events and invoke the same application/domain interfaces as synchronous requests.

## Simulation workers

A `draft.pick.recorded` event schedules derived-result computation for its exact session and version. Workers load the pinned projection dataset and configuration, run the deterministic recommendation pipeline, then execute the bounded Monte Carlo strategy described in [../simulation-design.md](../simulation-design.md). They persist snapshot/run summaries before broadcasting completion.

Jobs include deduplication keys derived from session version, algorithm version, simulation configuration, and candidate set. A newer session version supersedes older queued jobs; a worker may complete an old job but must not overwrite a newer snapshot.

## Ingestion workers

Provider data is staged, validated, normalized to canonical players, and published as an immutable projection dataset only after completeness checks pass. Failed imports retain diagnostics and do not change active datasets. Provider credentials remain in worker/server configuration and never appear in events. Initial jobs use Sleeper for draft snapshots, MySportsFeeds for projected stat lines, and Fantasy Football Calculator for daily ADP.

## Operations

Workers are horizontally scalable and have bounded concurrency, timeouts, retries with backoff, and dead-letter handling. Track queue depth, job duration, retry count, simulation throughput, and dataset freshness. Jobs are idempotent and must tolerate redelivery and process restarts.
