import { draftablePlayers, getDraftSession, prisma, scoreNflProjection } from "@draft-sense/data-access";
import { recommend } from "@draft-sense/recommendation";
import { nextPickForTeam, teamForOverallPick } from "@draft-sense/draft-engine";
import { runRosterSimulation } from "@draft-sense/simulation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../../server/http";
import { requireSelectedTeam, requireSessionAccess } from "../../../../../../server/auth";
const querySchema = z.object({
  trials: z.coerce.number().int().min(20).max(1000).default(200),
});
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { user, session: authorizedSession } = await requireSessionAccess(id);
    if (!authorizedSession)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
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
    const totalRounds =
      (session.settings as { draft?: { settings?: { rounds?: number } } }).draft?.settings
        ?.rounds ?? rosterPositions.length;
    const draftContext = (
      session.settings as {
        draft?: {
          slotToRosterId?: Record<string, string>;
          pickSchedule?: Array<{ overallPick: number; rosterId: string }>;
        };
      }
    ).draft;
    const userTeam = await requireSelectedTeam(id, user.id);
    const roster = session.picks
      .filter((pick) => pick.teamId === userTeam.id)
      .flatMap((pick) => pick.player.positions);
    const ranked = recommend({
      players: players.map(
        (item: {
          playerId: string;
          projectedPoints: number;
          adp: number | null;
          tier?: number | undefined;
          rankStdDev?: number | undefined;
          player: { fullName: string; positions: string[] };
        }) => ({
          id: item.playerId,
          name: item.player.fullName,
          position: item.player.positions[0] ?? "WR",
          projectedPoints: item.projectedPoints,
          adp: item.adp ?? undefined,
          tier: item.tier,
          rankStdDev: item.rankStdDev,
        }),
      ),
      draftedPlayerIds: session.picks.map((pick) => pick.playerId),
      rosterPositions,
      roster,
      teamCount: session.teamCount,
      currentOverallPick: (session.picks.at(-1)?.overallPick ?? 0) + 1,
      nextOverallPick: nextPickForTeam({
        currentOverallPick: (session.picks.at(-1)?.overallPick ?? 0) + 1,
        teamSlot: userTeam.slot,
        teamCount: session.teamCount,
        userRosterId: draftContext?.slotToRosterId?.[String(userTeam.slot)],
        pickSchedule: draftContext?.pickSchedule,
      }),
      totalRounds,
    }).slice(0, 12);
    const currentOverallPick = (session.picks.at(-1)?.overallPick ?? 0) + 1;
    const nextOverallPick = nextPickForTeam({
      currentOverallPick,
      teamSlot: userTeam.slot,
      teamCount: session.teamCount,
      userRosterId: draftContext?.slotToRosterId?.[String(userTeam.slot)],
      pickSchedule: draftContext?.pickSchedule,
    });
    const playerPool = players.slice(0, 200).map((player) => ({
      id: player.playerId,
      positions: player.player.positions,
      position: player.player.positions[0] ?? "WR",
      projectedPoints: player.projectedPoints,
      adp: player.adp ?? undefined,
      tier: player.tier ?? undefined,
    }));
    const playerPoolById = new Map(playerPool.map((player) => [player.id, player]));
    const candidates = ranked
      .slice(0, 8)
      .map((item) => playerPoolById.get(item.playerId))
      .filter((player): player is NonNullable<typeof player> => Boolean(player));
    const draftedProjections = await prisma.playerProjection.findMany({
      where: { datasetId: session.datasetId, playerId: { in: session.picks.map((pick) => pick.playerId) } },
      select: { playerId: true, metadata: true },
    });
    const scoringRules =
      (session.settings as { scoringRules?: Record<string, number> }).scoringRules ?? {};
    const draftedPoints = new Map(
      draftedProjections.map((projection) => [
        projection.playerId,
        scoreNflProjection(
          ((projection.metadata as { stats?: Record<string, number> } | null)?.stats ?? {}),
          scoringRules,
        ),
      ]),
    );
    const teamIdByRosterId = new Map(
      session.teams.flatMap((team) => {
        const rosterId = draftContext?.slotToRosterId?.[String(team.slot)];
        return rosterId ? [[rosterId, team.id] as const] : [];
      }),
    );
    const scheduledTeamIds = new Map(
      (draftContext?.pickSchedule ?? []).flatMap((pick) => {
        const teamId = teamIdByRosterId.get(pick.rosterId);
        return teamId ? [[pick.overallPick, teamId] as const] : [];
      }),
    );
    const futurePickTeamIds = Array.from(
      { length: Math.max(0, totalRounds * session.teamCount - currentOverallPick + 1) },
      (_, offset) => {
        const overallPick = currentOverallPick + offset;
        return (
          scheduledTeamIds.get(overallPick) ??
          session.teams.find(
            (team) => team.slot === teamForOverallPick(overallPick, session.teamCount),
          )?.id
        );
      },
    ).filter((teamId): teamId is string => Boolean(teamId));
    const seed = `${id}:${session.version}:${trials}`;
    const summary = runRosterSimulation({
      candidates,
      playerPool,
      teams: session.teams.map((team) => ({
        id: team.id,
        roster: session.picks
          .filter((pick) => pick.teamId === team.id)
          .map((pick) => ({
            id: pick.playerId,
            positions: pick.player.positions,
            position: pick.player.positions[0] ?? "WR",
            projectedPoints: draftedPoints.get(pick.playerId) ?? 0,
          })),
      })),
      userTeamId: userTeam.id,
      rosterPositions,
      futurePickTeamIds,
      currentOverallPick,
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
