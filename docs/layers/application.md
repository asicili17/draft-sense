# Application Layer

## Responsibility

Application services implement use cases: create a session, record or undo a pick, retrieve recommendations, request an explanation, and start a simulation. They coordinate authorization, transactions, domain engines, repositories, event publication, and external adapters. They do not contain HTTP-specific logic or duplicate domain formulas.

## Boundary and flow

Route handlers and workers call an application service with a typed command and request context. The service loads the aggregate, authorizes the actor, invokes the domain operation, persists changed state and an outbox event in one transaction, then returns a typed result.

Commands that mutate a draft carry its expected version and idempotency key. The layer converts domain failures to stable application errors; transports map them to HTTP/WebSocket error envelopes.

## Ports

Define interfaces here or in the consuming domain package for repositories, transaction manager, clock, ID generator, event dispatcher, simulation dispatcher, cache, explanation provider, league-platform provider, projection provider, and ADP provider. Composition roots select Prisma, Redis, OpenAI, queues, and concrete external-data adapters. No service imports a concrete provider SDK. See [Provider Adapter Architecture](../provider-adapters.md).

## Constraints

Application services may read a cached derived result but always fall back to durable/versioned inputs. They must preserve audit fields, propagate correlation IDs, and be safe to retry. They cannot let an explanation call delay or alter a pick transaction.

