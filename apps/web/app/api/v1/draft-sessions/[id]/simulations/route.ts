import { draftablePlayers, getDraftSession, prisma } from "@draft-sense/data-access";
import { recommend } from "@draft-sense/recommendation";
import { teamForOverallPick } from "@draft-sense/draft-engine";
import { runSimulation } from "@draft-sense/simulation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../../server/http";
const querySchema = z.object({
  trials: z.coerce.number().int().min(20).max(1000).default(200),
});
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { trials } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const session = await getDraftSession(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const players = await draftablePlayers(id);
    const rosterPositions =
      (session.settings as { rosterPositions?: string[] }).rosterPositions ?? [];
    const userTeam = session.teams.find((team) => team.slot === 1);
    const roster = userTeam
      ? session.picks
          .filter((pick) => pick.teamId === userTeam.id)
          .flatMap((pick) => pick.player.positions)
      : [];
    const ranked = recommend({
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
      draftedPlayerIds: session.picks.map((pick) => pick.playerId),
      rosterPositions,
      roster,
    }).slice(0, 12);
    let nextOverallPick = session.picks.length + 1;
    while (teamForOverallPick(nextOverallPick, session.teamCount) !== 1) nextOverallPick += 1;
    const picksUntilNextTurn = nextOverallPick - session.picks.length - 1;
    const seed = `${id}:${session.version}:${trials}`;
    const summary = runSimulation({
      candidates: ranked.map((item: { playerId: string; score: number }) => ({
        playerId: item.playerId,
        score: item.score,
        adp:
          players.find(
            (player: { playerId: string; adp: number | null }) => player.playerId === item.playerId,
          )?.adp ?? undefined,
      })),
      picksUntilNextTurn,
      trials,
      seed,
    });
    const resultJson = JSON.parse(JSON.stringify(summary)) as never;
    const run = await prisma.simulationRun.upsert({
      where: {
        sessionId_sessionVersion_seed: {
          sessionId: id,
          sessionVersion: session.version,
          seed,
        },
      },
      update: { result: resultJson, trials },
      create: {
        sessionId: id,
        sessionVersion: session.version,
        seed,
        trials,
        result: resultJson,
      },
    });
    return NextResponse.json({
      data: { sessionVersion: session.version, runId: run.id, summary },
    });
  } catch (error) {
    return apiError(error);
  }
}
