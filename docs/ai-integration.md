# AI Integration

## Role and boundary

OpenAI Responses API generates natural-language explanations for recommendations already selected by the deterministic engine. It does not rank players, alter scores, choose a draft pick, validate roster rules, or access draft state directly. The UI remains recommendation-first, not chat-first.

## Explanation request

The server constructs a compact structured input containing the selected player, alternative candidates, factor breakdown, tier and scarcity context, roster state, projection dataset/version, algorithm version, and confidence caveats. The model returns an explanation constrained by a schema: summary, supporting factors, tradeoffs, and uncertainty. Validate the response against that schema and render only server-supplied facts.

Prompts instruct the model to cite the supplied metrics, distinguish projections from facts, avoid invented injuries/news, avoid guarantees, and state uncertainty when confidence is low. Keep a versioned system prompt and record model, prompt version, input hash, latency, and redacted output metadata for evaluation.

## Tool/function calling

If interactive explanation needs additional context, expose read-only tools owned by the application, such as `get_recommendation_snapshot`, `get_player_profile`, and `get_roster_context`. Each tool accepts a session and snapshot ID, authorizes access, returns versioned structured data, and has strict output limits. Tool results are informational; no write, pick, ranking, simulation, or external-network tool is available to the model.

## RAG for news and analysis

Later, ingest licensed player news and trusted analysis into a versioned document store with source, publication date, sport/player tags, and embedding. Retrieve only relevant, recent, authorized documents, include source attribution and timestamps in the explanation context, and treat retrieval as supplemental context—not a replacement for projections. Enforce freshness windows, source allowlists, injection-resistant document handling, and a fallback that omits unverifiable news.

Apply request rate limits, data minimization, output moderation appropriate to the product, retries with backoff, response caching by snapshot/prompt version, and a deterministic template fallback when OpenAI is unavailable.

