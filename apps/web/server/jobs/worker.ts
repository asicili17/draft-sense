import {
  draftablePlayers,
  getDraftSession,
  importSleeperLeague,
  prisma,
  scoreNflProjection,
} from "@draft-sense/data-access";
import { ALGORITHM_VERSION, recommend } from "@draft-sense/recommendation";
import { runRosterSimulation } from "@draft-sense/simulation";
import { nextPickForTeam, teamForOverallPick } from "@draft-sense/draft-engine";
import type { DraftSenseJob } from "@draft-sense/events";
import { buildAppContainer } from "../container";
import { parseEnvironment } from "../env";
import { enqueueJob } from "./queue";
import { jobTelemetry } from "./telemetry";
import { publishDraftUpdate } from "../realtime/upstash";

async function recompute(sessionId: string, expectedVersion?: number) {
  const session = await getDraftSession(sessionId);
  if (!session || (expectedVersion !== undefined && session.version !== expectedVersion)) return;
  const selection = await prisma.userDraftTeamSelection.findFirst({
    where: { sessionId },
    include: { team: true },
  });
  if (!selection) return;
  const rosterPositions =
    (session.settings as { rosterPositions?: string[] }).rosterPositions ?? [];
  const draftContext = (
    session.settings as {
      draft?: {
        settings?: { rounds?: number };
        slotToRosterId?: Record<string, string>;
        pickSchedule?: Array<{ overallPick: number; rosterId: string }>;
      };
    }
  ).draft;
  const totalRounds = draftContext?.settings?.rounds ?? rosterPositions.length;
  const currentOverallPick = (session.picks.at(-1)?.overallPick ?? 0) + 1;
  const nextOverallPick = nextPickForTeam({
    currentOverallPick,
    teamSlot: selection.team.slot,
    teamCount: session.teamCount,
    userRosterId: draftContext?.slotToRosterId?.[String(selection.team.slot)],
    pickSchedule: draftContext?.pickSchedule,
  });
  const players = await draftablePlayers(sessionId);
  const roster = session.picks
    .filter((pick) => pick.teamId === selection.teamId)
    .flatMap((pick) => pick.player.positions);
  const results = recommend({
    players: players.map((item) => ({
      id: item.playerId,
      name: item.player.fullName,
      position: item.player.positions[0] ?? "WR",
      projectedPoints: item.projectedPoints,
      adp: item.adp ?? undefined,
      tier: item.tier ?? undefined,
      rankStdDev: item.rankStdDev ?? undefined,
    })),
    draftedPlayerIds: session.picks.map((pick) => pick.playerId),
    rosterPositions,
    roster,
    teamCount: session.teamCount,
    currentOverallPick,
    nextOverallPick,
    totalRounds,
  });
  jobTelemetry("recommendations.computed", {
    sessionId,
    sessionVersion: session.version,
    playerCount: players.length,
    recommendationCount: results.length,
    rosterSlotCount: rosterPositions.length,
  });
  const current = await prisma.draftSession.findUnique({
    where: { id: sessionId },
    select: { version: true },
  });
  if (!current || current.version !== session.version) return;
  const algorithmVersion = `${ALGORITHM_VERSION}:dataset:${session.datasetId}:team:${selection.teamId}`;
  await prisma.recommendationSnapshot.upsert({
    where: {
      sessionId_sessionVersion_algorithmVersion: {
        sessionId,
        sessionVersion: session.version,
        algorithmVersion,
      },
    },
    update: {},
    create: {
      sessionId,
      sessionVersion: session.version,
      algorithmVersion,
      input: {
        rosterPositions,
        roster,
        teamCount: session.teamCount,
        totalRounds,
        currentOverallPick,
        nextOverallPick,
        selectedTeamId: selection.teamId,
        datasetId: session.datasetId,
      },
      result: JSON.parse(JSON.stringify(results)),
    },
  });
  await publishDraftUpdate({
    type: "recommendations.updated",
    sessionId,
    sessionVersion: session.version,
  });
  await enqueueJob({ type: "simulation.run", sessionId, sessionVersion: session.version });
}

async function simulate(sessionId: string, expectedVersion?: number) {
  const session = await getDraftSession(sessionId);
  if (!session || (expectedVersion !== undefined && session.version !== expectedVersion)) return;
  const selection = await prisma.userDraftTeamSelection.findFirst({
    where: { sessionId },
    include: { team: true },
  });
  if (!selection) return;
  const snapshot = await prisma.recommendationSnapshot.findFirst({
    where: { sessionId, sessionVersion: session.version },
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) return;
  const ranked = snapshot.result as Array<{ playerId: string; score: number }>;
  const players = await draftablePlayers(sessionId);
  const rosterPositions =
    (session.settings as { rosterPositions?: string[] }).rosterPositions ?? [];
  const draftContext = (
    session.settings as {
      draft?: {
        settings?: { rounds?: number };
        slotToRosterId?: Record<string, string>;
        pickSchedule?: Array<{ overallPick: number; rosterId: string }>;
      };
    }
  ).draft;
  const currentOverallPick = (session.picks.at(-1)?.overallPick ?? 0) + 1;
  const next = nextPickForTeam({
    currentOverallPick,
    teamSlot: selection.team.slot,
    teamCount: session.teamCount,
    userRosterId: draftContext?.slotToRosterId?.[String(selection.team.slot)],
    pickSchedule: draftContext?.pickSchedule,
  });
  const totalRounds = draftContext?.settings?.rounds ?? rosterPositions.length;
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
  if (!candidates.length) return;
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
  const teams = session.teams.map((team) => ({
    id: team.id,
    // Already drafted players establish both positional eligibility and the fixed
    // portion of the projected starting lineup in every candidate path.
    roster: session.picks
      .filter((pick) => pick.teamId === team.id)
      .map((pick) => ({
        id: pick.playerId,
        positions: pick.player.positions,
        position: pick.player.positions[0] ?? "WR",
        projectedPoints: draftedPoints.get(pick.playerId) ?? 0,
      })),
  }));
  const trials = 120;
  const seed = `${sessionId}:${session.version}:${trials}`;
  const result = runRosterSimulation({
    candidates,
    playerPool,
    teams,
    userTeamId: selection.teamId,
    rosterPositions,
    futurePickTeamIds,
    currentOverallPick,
    trials,
    seed,
  });
  const current = await prisma.draftSession.findUnique({
    where: { id: sessionId },
    select: { version: true },
  });
  if (!current || current.version !== session.version) return;
  const roster = session.picks
    .filter((pick) => pick.teamId === selection.teamId)
    .flatMap((pick) => pick.player.positions);
  const reranked = recommend({
    players: players.map((item) => ({
      id: item.playerId,
      name: item.player.fullName,
      position: item.player.positions[0] ?? "WR",
      projectedPoints: item.projectedPoints,
      adp: item.adp ?? undefined,
      tier: item.tier ?? undefined,
      rankStdDev: item.rankStdDev ?? undefined,
    })),
    draftedPlayerIds: session.picks.map((pick) => pick.playerId),
    rosterPositions,
    roster,
    teamCount: session.teamCount,
    currentOverallPick,
    nextOverallPick: next,
    totalRounds,
    simulation: result,
  });
  await prisma.recommendationSnapshot.update({
    where: { id: snapshot.id },
    data: { result: JSON.parse(JSON.stringify(reranked)) },
  });
  await prisma.simulationRun.upsert({
    where: { sessionId_sessionVersion_seed: { sessionId, sessionVersion: session.version, seed } },
    update: { result: JSON.parse(JSON.stringify(result)), trials },
    create: {
      sessionId,
      sessionVersion: session.version,
      seed,
      trials,
      result: JSON.parse(JSON.stringify(result)),
    },
  });
  await publishDraftUpdate({
    type: "recommendations.updated",
    sessionId,
    sessionVersion: session.version,
  });
  await publishDraftUpdate({
    type: "simulation.updated",
    sessionId,
    sessionVersion: session.version,
  });
}

async function refreshSleeper(sessionId: string) {
  const session = await getDraftSession(sessionId);
  if (!session || session.status !== "LIVE") return;
  const pollSeconds = parseEnvironment().LIVE_DRAFT_POLL_SECONDS;
  // Browser session reads act as a heartbeat. Do not keep polling abandoned rooms.
  if (Date.now() - session.lastViewedAt.getTime() > pollSeconds * 3_000) return;
  const source = (session.settings as { source?: { leagueId?: string; draftId?: string } }).source;
  const selection = await prisma.userDraftTeamSelection.findFirst({
    where: { sessionId },
    include: { team: true },
  });
  if (!source?.leagueId || !source.draftId || !selection) return;
  const sleeper = buildAppContainer().sleeper;
  const [league, draft] = await Promise.all([
    sleeper.getLeagueSnapshot({ leagueId: source.leagueId }),
    sleeper.getDraftSnapshot({ draftId: source.draftId, leagueId: source.leagueId }),
  ]);
  const refreshed = await importSleeperLeague({
    league,
    draft,
    ownerId: session.ownerId,
    selectedTeamSlot: selection.team.slot,
  });
  if (!refreshed) return;
  if (refreshed.version > session.version)
    await publishDraftUpdate({
      type: "draft.updated",
      sessionId,
      sessionVersion: refreshed.version,
    });
  if (
    draft.status !== "complete" &&
    Date.now() - refreshed.lastViewedAt.getTime() <= pollSeconds * 3_000
  )
    await enqueueJob({ type: "sleeper.refresh.requested", sessionId }, pollSeconds);
}

export async function executeJob(job: DraftSenseJob) {
  const startedAt = Date.now();
  jobTelemetry("job.started", {
    type: job.type,
    sessionId: job.sessionId,
    sessionVersion: job.sessionVersion,
  });
  try {
    if (job.type === "sleeper.refresh.requested") await refreshSleeper(job.sessionId);
    if (job.type === "simulation.run") await simulate(job.sessionId, job.sessionVersion);
    if (job.type === "draft.pick.recorded" || job.type === "recommendations.recompute")
      await recompute(job.sessionId, job.sessionVersion);
    jobTelemetry("job.completed", {
      type: job.type,
      sessionId: job.sessionId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    jobTelemetry("job.failed", {
      type: job.type,
      sessionId: job.sessionId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
