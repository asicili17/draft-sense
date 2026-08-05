import { prisma } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../../../server/http";
import { requireSessionAccess } from "../../../../../../../server/auth";

const requestSchema = z.object({ snapshotId: z.string().uuid(), playerId: z.string().uuid() });
const modelSchema = z.object({
  summary: z.string().max(500),
  supportingFactors: z.array(z.string().max(220)).max(3),
  tradeoffs: z.array(z.string().max(220)).max(2),
  uncertainty: z.string().max(300),
});
const recentRequests = new Map<string, number[]>();

function fallback(name: string, confidence: number, factors: Record<string, number>) {
  return {
    source: "template" as const,
    summary: `${name} is the best available fit in the saved deterministic ranking.`,
    supportingFactors: [
      `Value over replacement: ${(factors.vorp ?? 0).toFixed(1)}.`,
      `Roster-fit score: ${(factors.rosterFit ?? 0).toFixed(2)}; scarcity: ${(factors.scarcity ?? 0).toFixed(2)}.`,
    ],
    tradeoffs: ["This explanation does not change the recommendation or its score."],
    uncertainty: `Ranking stability is ${Math.round(confidence * 100)}%. Projections and draft outcomes remain uncertain.`,
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { session: authorizedSession } = await requireSessionAccess(id);
    if (!authorizedSession)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const body = requestSchema.parse(await request.json());
    const now = Date.now();
    const requests = (recentRequests.get(id) ?? []).filter((time) => now - time < 60_000);
    if (requests.length >= 6)
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Try another explanation in a minute." } },
        { status: 429 },
      );
    requests.push(now);
    recentRequests.set(id, requests);
    const snapshot = await prisma.recommendationSnapshot.findFirst({
      where: { id: body.snapshotId, sessionId: id },
    });
    if (!snapshot)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Recommendation snapshot not found." } },
        { status: 404 },
      );
    const recommendations = z
      .array(
        z.object({
          playerId: z.string(),
          name: z.string(),
          confidence: z.number(),
          factors: z.object({
            vorp: z.number(),
            scarcity: z.number(),
            rosterFit: z.number(),
            adpValue: z.number(),
            risk: z.number(),
          }),
        }),
      )
      .parse(snapshot.result);
    const selected = recommendations.find((item) => item.playerId === body.playerId);
    if (!selected)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Player is not in this recommendation snapshot." } },
        { status: 404 },
      );
    const template = fallback(selected.name, selected.confidence, selected.factors);
    // Explanations are deliberately optional. A missing key, timeout, or invalid response always uses the
    // deterministic template and never blocks the draft workflow.
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ data: template });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Explain this already-selected fantasy recommendation using only these facts: ${JSON.stringify(selected)}. Return JSON with summary, supportingFactors, tradeoffs, uncertainty. Do not make injury, news, or outcome claims.`,
        text: { format: { type: "json_object" } },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json()) as { output_text?: string };
    const explanation =
      response.ok && payload.output_text
        ? modelSchema.safeParse(JSON.parse(payload.output_text))
        : null;
    return NextResponse.json({
      data: explanation?.success ? { source: "openai", ...explanation.data } : template,
    });
  } catch (error) {
    return apiError(error);
  }
}
