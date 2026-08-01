# API Design

All REST endpoints are versioned under `/api/v1`, use JSON, require authenticated users unless noted, and return ISO-8601 UTC timestamps. Use a request ID header (`X-Request-Id`) for tracing. Mutating endpoints accept `Idempotency-Key`.

## REST endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/players` | Filter players by sport, position, dataset, and availability. |
| `GET` | `/projection-datasets` | List available versioned datasets. |
| `POST` | `/draft-sessions` | Create a configured session. |
| `GET` | `/draft-sessions/{id}` | Read session, teams, picks, and current version. |
| `PATCH` | `/draft-sessions/{id}` | Update allowed pre-draft settings. |
| `POST` | `/draft-sessions/{id}/picks` | Record a pick with expected version. |
| `DELETE` | `/draft-sessions/{id}/picks/{overallPick}` | Undo the latest authorized pick. |
| `GET` | `/draft-sessions/{id}/recommendations` | Read the latest deterministic result. |
| `POST` | `/draft-sessions/{id}/recommendations/explanation` | Request an explanation for a specified snapshot/player. |
| `POST` | `/draft-sessions/{id}/simulations` | Start or retrieve a keyed simulation run. |

### Record a pick

```http
POST /api/v1/draft-sessions/ds_123/picks
Idempotency-Key: 32e...
```

```json
{ "playerId": "pl_42", "expectedVersion": 17 }
```

```json
{
  "data": {
    "pick": { "overallPick": 18, "teamId": "dt_2", "playerId": "pl_42" },
    "sessionVersion": 18
  }
}
```

### Recommendations

```json
{
  "data": {
    "sessionVersion": 18,
    "algorithmVersion": "2026.1",
    "recommendations": [{
      "playerId": "pl_7",
      "score": 82.4,
      "confidence": 0.87,
      "factors": { "vorp": 14.1, "scarcity": 8.2, "need": 6.0, "availability": 0.71 }
    }]
  }
}
```

## WebSocket events

Clients connect to `/api/v1/ws`, authenticate during connection setup, then subscribe to `draft:{sessionId}` after authorization.

| Event | Direction | Payload |
| --- | --- | --- |
| `draft.subscribe` | client → server | `{ sessionId }` |
| `draft.updated` | server → client | `{ sessionId, sessionVersion, pick }` |
| `recommendations.updated` | server → client | `{ sessionId, sessionVersion, snapshot }` |
| `simulation.updated` | server → client | `{ sessionId, sessionVersion, runId, status, summary }` |
| `error` | server → client | standard error envelope |

Clients must apply only messages whose version is newer than their current version and refetch after a gap.

## Errors

All failures use:

```json
{ "error": { "code": "VERSION_CONFLICT", "message": "Draft state changed.", "requestId": "..." } }
```

Use `400` validation errors, `401` unauthenticated, `403` unauthorized, `404` absent resources, `409` version/duplicate-pick conflicts, `422` invalid draft state, `429` rate limited, and `500` unexpected errors. Expose stable codes, not database or provider messages.

