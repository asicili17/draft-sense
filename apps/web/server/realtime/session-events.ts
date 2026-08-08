import { prisma } from "@draft-sense/data-access";
import type { DraftRealtimeEvent } from "@draft-sense/events";

export type SessionEventState = {
  sessionVersion: number;
  recommendationId: string | null;
  recommendationVersion: number | null;
  simulationId: string | null;
  simulationVersion: number | null;
};

export async function readSessionEventState(sessionId: string): Promise<SessionEventState | null> {
  const [session, recommendation, simulation] = await Promise.all([
    prisma.draftSession.findUnique({
      where: { id: sessionId },
      select: { version: true },
    }),
    prisma.recommendationSnapshot.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, sessionVersion: true },
    }),
    prisma.simulationRun.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, sessionVersion: true },
    }),
  ]);
  if (!session) return null;
  return {
    sessionVersion: session.version,
    recommendationId: recommendation?.id ?? null,
    recommendationVersion: recommendation?.sessionVersion ?? null,
    simulationId: simulation?.id ?? null,
    simulationVersion: simulation?.sessionVersion ?? null,
  };
}

export function changedSessionEvents(
  sessionId: string,
  previous: SessionEventState,
  next: SessionEventState,
): DraftRealtimeEvent[] {
  const events: DraftRealtimeEvent[] = [];
  if (next.sessionVersion > previous.sessionVersion)
    events.push({ type: "draft.updated", sessionId, sessionVersion: next.sessionVersion });
  if (next.recommendationId !== previous.recommendationId && next.recommendationVersion !== null)
    events.push({
      type: "recommendations.updated",
      sessionId,
      sessionVersion: next.recommendationVersion,
    });
  if (next.simulationId !== previous.simulationId && next.simulationVersion !== null)
    events.push({ type: "simulation.updated", sessionId, sessionVersion: next.simulationVersion });
  return events;
}
