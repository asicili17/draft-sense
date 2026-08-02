# AI Explanation Layer

## Responsibility

The AI layer is an adapter that converts a completed, deterministic recommendation snapshot into a concise explanation. It uses the OpenAI Responses API and cannot influence player selection, scoring, simulations, draft state, or event publication. The complete policy is in [../ai-integration.md](../ai-integration.md).

## Input contract

The application passes a constrained DTO: selected recommendation, alternatives, numerical factor breakdown, roster context, dataset/algorithm versions, and confidence caveats. The adapter never reads a mutable draft directly and does not receive credentials, unneeded personal data, or raw provider records.

Prompts are versioned and require a structured response with summary, supporting factors, tradeoffs, and uncertainty. The adapter validates the response schema, strips unsupported claims, and returns a safe template explanation if the model fails or times out.

## Tool and retrieval boundary

Optional model tools are read-only, authorized server functions returning bounded, versioned data. Future RAG retrieves only licensed, tagged, fresh documents and includes their attribution. Retrieval supplements structured recommendation data; it never changes engine output.

## Operations and safety

Cache by snapshot ID and prompt version; rate-limit per user/session; record redacted telemetry for quality and cost. Enforce output limits and treat all model output as untrusted display text. Model/provider outages degrade only explanations, never draft recommendations or pick recording.
