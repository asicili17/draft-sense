import { draftablePlayers, getDraftSession, prisma } from "@draft-sense/data-access";
import { ALGORITHM_VERSION, recommend } from "@draft-sense/recommendation";
import { NextResponse } from "next/server";
import { apiError } from "../../../../../../server/http";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const session = await getDraftSession(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const rosterPositions =
      (session.settings as { rosterPositions?: string[] }).rosterPositions ?? [];
    const players = await draftablePlayers(id);
    const userTeam = session.teams.find((team) => team.slot === 1);
    const roster = userTeam
      ? session.picks
          .filter((pick) => pick.teamId === userTeam.id)
          .flatMap((pick) => pick.player.positions)
      : [];
    const existingSnapshot = await prisma.recommendationSnapshot.findUnique({
      where: {
        sessionId_sessionVersion_algorithmVersion: {
          sessionId: id,
          sessionVersion: session.version,
          algorithmVersion: ALGORITHM_VERSION,
        },
      },
    });
    if (existingSnapshot)
      return NextResponse.json({
        data: {
          sessionVersion: session.version,
          algorithmVersion: ALGORITHM_VERSION,
          recommendations: existingSnapshot.result,
          snapshotId: existingSnapshot.id,
        },
      });
    const results = recommend({
      players: players.map(
        (item: {
          playerId: string;
          projectedPoints: number;
          adp: number | null;
          player: { fullName: string; positions: string[] };
        }) => ({
          id: item.playerId,
          name: item.player.fullName,
          position: item.player.positions[0] ?? "WR",
          projectedPoints: item.projectedPoints,
          adp: item.adp ?? undefined,
        }),
      ),
      draftedPlayerIds: session.picks.map((pick: { playerId: string }) => pick.playerId),
      rosterPositions,
      roster,
    });
    const resultJson = JSON.parse(JSON.stringify(results)) as never;
    const snapshot = await prisma.recommendationSnapshot.create({
      data: {
        sessionId: id,
        sessionVersion: session.version,
        algorithmVersion: ALGORITHM_VERSION,
        input: { rosterPositions, roster, datasetId: session.datasetId },
        result: resultJson,
      },
    });
    return NextResponse.json({
      data: {
        sessionVersion: session.version,
        algorithmVersion: ALGORITHM_VERSION,
        recommendations: results,
        snapshotId: snapshot.id,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
