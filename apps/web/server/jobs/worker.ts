import {
  draftablePlayers,
  getDraftSession,
  importSleeperLeague,
  prisma,
} from "@draft-sense/data-access";
import { ALGORITHM_VERSION, recommend } from "@draft-sense/recommendation";
import { runSimulation } from "@draft-sense/simulation";
import { nextPickForTeam } from "@draft-sense/draft-engine";
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
  const draftContext = (
    session.settings as {
      draft?: {
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
  const trials = 200;
  const seed = `${sessionId}:${session.version}:${trials}`;
  const result = runSimulation({
    candidates: ranked.slice(0, 12).map((item) => ({
      playerId: item.playerId,
      score: item.score,
      adp: players.find((player) => player.playerId === item.playerId)?.adp ?? undefined,
    })),
    picksUntilNextTurn: next - currentOverallPick,
    trials,
    seed,
  });
  const current = await prisma.draftSession.findUnique({
    where: { id: sessionId },
    select: { version: true },
  });
  if (!current || current.version !== session.version) return;
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
