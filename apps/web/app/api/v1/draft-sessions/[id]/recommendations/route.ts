import { draftablePlayers, getDraftSession, prisma } from "@draft-sense/data-access";
import { ALGORITHM_VERSION } from "@draft-sense/recommendation";
import { NextResponse } from "next/server";
import { apiError } from "../../../../../../server/http";
import { requireSelectedTeam, requireSessionAccess } from "../../../../../../server/auth";
import { publishPendingOutbox } from "../../../../../../server/jobs/outbox-publisher";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { user, session: authorizedSession } = await requireSessionAccess(id);
    if (!authorizedSession)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const session = await getDraftSession(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const userTeam = await requireSelectedTeam(id, user.id);
    const algorithmVersion = `${ALGORITHM_VERSION}:dataset:${session.datasetId}:team:${userTeam.id}`;
    const existingSnapshot = await prisma.recommendationSnapshot.findUnique({
      where: {
        sessionId_sessionVersion_algorithmVersion: {
          sessionId: id,
          sessionVersion: session.version,
          algorithmVersion,
        },
      },
    });
    if (existingSnapshot) {
      const recommendations = Array.isArray(existingSnapshot.result)
        ? existingSnapshot.result
        : [];
      // A projection import and a draft refresh can overlap. Keep the board useful
      // if a legacy or partial snapshot was written without ranked rows instead of
      // leaving the manager with a blank recommendation rail.
      const fallback =
        recommendations.length > 0
          ? []
          : (await draftablePlayers(id)).slice(0, 5).map((player) => ({
              playerId: player.playerId,
              name: player.player.fullName,
              score: Number(player.projectedPoints.toFixed(2)),
              confidence: 0.4,
              reason: "Top projected available player while personalized ranking refreshes.",
              factors: {},
            }));
      return NextResponse.json({
        data: {
          sessionVersion: session.version,
          algorithmVersion,
          recommendations: recommendations.length ? recommendations : fallback,
          snapshotId: recommendations.length ? existingSnapshot.id : null,
          fallback: recommendations.length === 0,
        },
      });
    }
    const pendingRecompute = await prisma.outboxEvent.findFirst({
      // QStash marks an outbox event delivered before the worker writes its
      // snapshot. Keep a short delivery window so concurrent UI/SSE reads do
      // not enqueue duplicate recomputes for the same board state.
      where: {
        sessionId: id,
        type: { in: ["draft.pick.recorded", "recommendations.recompute"] },
        deadLetteredAt: null,
        createdAt: { gte: new Date(Date.now() - 10_000) },
      },
    });
    if (!pendingRecompute)
      await prisma.outboxEvent.create({
        data: {
          sessionId: id,
          type: "recommendations.recompute",
          payload: { sessionVersion: session.version },
        },
      });
    await publishPendingOutbox().catch(() => undefined);
    const previousSnapshot = await prisma.recommendationSnapshot.findFirst({
      where: { sessionId: id, algorithmVersion },
      orderBy: { sessionVersion: "desc" },
    });
    const fallback = (await draftablePlayers(id)).slice(0, 5).map((player) => ({
      playerId: player.playerId,
      name: player.player.fullName,
      score: Number(player.projectedPoints.toFixed(2)),
      confidence: 0.4,
      reason: "Top projected available player while personalized ranking refreshes.",
      factors: {},
    }));
    const previousRecommendations = Array.isArray(previousSnapshot?.result)
      ? previousSnapshot.result
      : [];
    const showFallback = previousRecommendations.length === 0;
    return NextResponse.json({
      data: {
        sessionVersion: session.version,
        algorithmVersion: ALGORITHM_VERSION,
        recommendations: showFallback ? fallback : previousRecommendations,
        snapshotId: showFallback ? null : previousSnapshot?.id ?? null,
        pending: true,
        snapshotVersion: previousSnapshot?.sessionVersion ?? null,
        fallback: showFallback,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
