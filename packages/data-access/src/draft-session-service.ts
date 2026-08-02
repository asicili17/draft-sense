import type { Position, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { DraftSnapshot, LeagueSnapshot } from "@draft-sense/providers";
const DEFAULT_OWNER_EMAIL = "local-user@draftsense.app";
const positionSet = new Set<Position>(["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"]);
export async function importSleeperLeague(input: { league: LeagueSnapshot; draft: DraftSnapshot }) {
  const owner = await prisma.user.upsert({ where: { email: DEFAULT_OWNER_EMAIL }, update: {}, create: { email: DEFAULT_OWNER_EMAIL, displayName: "DraftSense user" } });
  const league = await prisma.league.upsert({ where: { ownerId_name: { ownerId: owner.id, name: input.league.league.name } }, update: {}, create: { ownerId: owner.id, sport: "NFL", name: input.league.league.name } });
  await prisma.leagueIntegration.upsert({ where: { provider_externalLeagueId: { provider: "sleeper", externalLeagueId: input.league.league.externalLeagueId } }, update: { externalDraftId: input.draft.draftId, lastSyncedAt: input.draft.retrievedAt, leagueId: league.id }, create: { provider: "sleeper", externalLeagueId: input.league.league.externalLeagueId, externalDraftId: input.draft.draftId, lastSyncedAt: input.draft.retrievedAt, leagueId: league.id } });
  const scoring = await prisma.scoringFormat.upsert({ where: { sport_name_version: { sport: "NFL", name: `Sleeper ${input.league.league.name}`, version: 1 } }, update: { rules: input.league.scoringRules as Prisma.InputJsonValue }, create: { sport: "NFL", name: `Sleeper ${input.league.league.name}`, version: 1, rules: input.league.scoringRules as Prisma.InputJsonValue } });
  const dataset = await prisma.projectionDataset.findFirst({ where: { sport: "NFL" }, orderBy: { publishedAt: "desc" } });
  if (!dataset) throw new Error("No projection dataset is available yet. Import projections before creating a draft session.");
  const teamCount = Math.max(input.draft.teams.length, ...input.draft.picks.map((pick) => Number(pick.rosterId)), 2);
  const settings = { rosterPositions: input.league.rosterPositions, scoringRules: input.league.scoringRules, source: { provider: "sleeper", draftId: input.draft.draftId, syncedAt: input.draft.retrievedAt.toISOString() } };
  const existing = await prisma.draftSession.findFirst({ where: { leagueId: league.id, status: { not: "COMPLETE" } }, orderBy: { id: "desc" } });
  const session = existing ? await prisma.draftSession.update({ where: { id: existing.id }, data: { datasetId: dataset.id, scoringFormatId: scoring.id, teamCount, settings: settings as Prisma.InputJsonValue } }) : await prisma.draftSession.create({ data: { leagueId: league.id, ownerId: owner.id, datasetId: dataset.id, scoringFormatId: scoring.id, sport: "NFL", status: input.draft.status === "complete" ? "COMPLETE" : "LIVE", draftType: "SNAKE", teamCount, settings: settings as Prisma.InputJsonValue } });
  await prisma.draftTeam.deleteMany({ where: { sessionId: session.id } });
  await prisma.draftTeam.createMany({ data: Array.from({ length: teamCount }, (_, index) => { const slot = index + 1; return { sessionId: session.id, slot, name: input.draft.teams.find((team) => team.slot === slot)?.name ?? `Team ${slot}` }; }) });
  return getDraftSession(session.id);
}
export async function getDraftSession(id: string) { return prisma.draftSession.findUnique({ where: { id }, include: { teams: { orderBy: { slot: "asc" } }, picks: { orderBy: { overallPick: "asc" }, include: { player: true, team: true } }, dataset: true, scoringFormat: true } }); }
export async function draftablePlayers(sessionId: string) { const session = await prisma.draftSession.findUniqueOrThrow({ where: { id: sessionId }, include: { picks: true } }); return prisma.playerProjection.findMany({ where: { datasetId: session.datasetId, scoringFormatId: session.scoringFormatId, player: { sport: "NFL", NOT: { id: { in: session.picks.map((pick) => pick.playerId) } } } }, include: { player: true }, take: 250, orderBy: { projectedPoints: "desc" } }); }
export { positionSet };
