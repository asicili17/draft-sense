import { draftablePlayers, getDraftSession, importSleeperLeague, prisma } from "@draft-sense/data-access";
import { ALGORITHM_VERSION, recommend } from "@draft-sense/recommendation";
import { runSimulation } from "@draft-sense/simulation";
import { teamForOverallPick } from "@draft-sense/draft-engine";
import type { DraftSenseJob } from "@draft-sense/events";
import { buildAppContainer } from "../container";
import { parseEnvironment } from "../env";
import { enqueueJob } from "./queue";
import { jobTelemetry } from "./telemetry";

async function recompute(sessionId: string, expectedVersion?: number) {
  const session = await getDraftSession(sessionId);
  if (!session || (expectedVersion !== undefined && session.version !== expectedVersion)) return;
  const selection = await prisma.userDraftTeamSelection.findFirst({ where: { sessionId }, include: { team: true } });
  if (!selection) return;
  const rosterPositions = (session.settings as { rosterPositions?: string[] }).rosterPositions ?? [];
  const players = await draftablePlayers(sessionId);
  const roster = session.picks.filter((pick) => pick.teamId === selection.teamId).flatMap((pick) => pick.player.positions);
  const results = recommend({
    players: players.map((item) => ({ id: item.playerId, name: item.player.fullName, position: item.player.positions[0] ?? "WR", projectedPoints: item.projectedPoints, adp: item.adp ?? undefined })),
    draftedPlayerIds: session.picks.map((pick) => pick.playerId), rosterPositions, roster,
  });
  const current = await prisma.draftSession.findUnique({ where: { id: sessionId }, select: { version: true } });
  if (!current || current.version !== session.version) return;
  const algorithmVersion = `${ALGORITHM_VERSION}:team:${selection.teamId}`;
  await prisma.recommendationSnapshot.upsert({
    where: { sessionId_sessionVersion_algorithmVersion: { sessionId, sessionVersion: session.version, algorithmVersion } },
    update: {},
    create: { sessionId, sessionVersion: session.version, algorithmVersion, input: { rosterPositions, roster, selectedTeamId: selection.teamId, datasetId: session.datasetId }, result: JSON.parse(JSON.stringify(results)) },
  });
  await enqueueJob({ type: "simulation.run", sessionId, sessionVersion: session.version });
}

async function simulate(sessionId: string, expectedVersion?: number) {
  const session = await getDraftSession(sessionId);
  if (!session || (expectedVersion !== undefined && session.version !== expectedVersion)) return;
  const selection = await prisma.userDraftTeamSelection.findFirst({ where: { sessionId }, include: { team: true } });
  if (!selection) return;
  const snapshot = await prisma.recommendationSnapshot.findFirst({ where: { sessionId, sessionVersion: session.version }, orderBy: { createdAt: "desc" } });
  if (!snapshot) return;
  const ranked = snapshot.result as Array<{ playerId: string; score: number }>;
  const players = await draftablePlayers(sessionId);
  let next = session.picks.length + 1;
  while (teamForOverallPick(next, session.teamCount) !== selection.team.slot) next += 1;
  const trials = 200;
  const seed = `${sessionId}:${session.version}:${trials}`;
  const result = runSimulation({ candidates: ranked.slice(0, 12).map((item) => ({ playerId: item.playerId, score: item.score, adp: players.find((player) => player.playerId === item.playerId)?.adp ?? undefined })), picksUntilNextTurn: next - session.picks.length - 1, trials, seed });
  const current = await prisma.draftSession.findUnique({ where: { id: sessionId }, select: { version: true } });
  if (!current || current.version !== session.version) return;
  await prisma.simulationRun.upsert({ where: { sessionId_sessionVersion_seed: { sessionId, sessionVersion: session.version, seed } }, update: { result: JSON.parse(JSON.stringify(result)), trials }, create: { sessionId, sessionVersion: session.version, seed, trials, result: JSON.parse(JSON.stringify(result)) } });
}

async function refreshSleeper(sessionId: string) {
  const session = await getDraftSession(sessionId);
  if (!session || session.status !== "LIVE") return;
  const pollSeconds = parseEnvironment().LIVE_DRAFT_POLL_SECONDS;
  // Browser session reads act as a heartbeat. Do not keep polling abandoned rooms.
  if (Date.now() - session.lastViewedAt.getTime() > pollSeconds * 3_000) return;
  const source = (session.settings as { source?: { leagueId?: string; draftId?: string } }).source;
  const selection = await prisma.userDraftTeamSelection.findFirst({ where: { sessionId }, include: { team: true } });
  if (!source?.leagueId || !source.draftId || !selection) return;
  const sleeper = buildAppContainer().sleeper;
  const [league, draft] = await Promise.all([sleeper.getLeagueSnapshot({ leagueId: source.leagueId }), sleeper.getDraftSnapshot({ draftId: source.draftId, leagueId: source.leagueId })]);
  await importSleeperLeague({ league, draft, ownerId: session.ownerId, selectedTeamSlot: selection.team.slot });
  if (draft.status !== "complete")
    await enqueueJob({ type: "sleeper.refresh.requested", sessionId }, pollSeconds);
}

export async function executeJob(job: DraftSenseJob) {
  const startedAt = Date.now();
  jobTelemetry("job.started", { type: job.type, sessionId: job.sessionId, sessionVersion: job.sessionVersion });
  try {
    if (job.type === "sleeper.refresh.requested") await refreshSleeper(job.sessionId);
    if (job.type === "simulation.run") await simulate(job.sessionId, job.sessionVersion);
    if (job.type === "draft.pick.recorded" || job.type === "recommendations.recompute")
      await recompute(job.sessionId, job.sessionVersion);
    jobTelemetry("job.completed", { type: job.type, sessionId: job.sessionId, durationMs: Date.now() - startedAt });
  } catch (error) {
    jobTelemetry("job.failed", { type: job.type, sessionId: job.sessionId, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" });
    throw error;
  }
}
