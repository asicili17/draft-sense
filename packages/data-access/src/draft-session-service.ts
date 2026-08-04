import type { Position, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { scoreNflProjection } from "./nfl-scoring";
import type { DraftSnapshot, LeagueSnapshot } from "@draft-sense/providers";
const DEFAULT_OWNER_EMAIL = "local-user@draftsense.app";
const positionSet = new Set<Position>(["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"]);
export async function importSleeperLeague(input: { league: LeagueSnapshot; draft: DraftSnapshot }) {
  const owner = await prisma.user.upsert({
    where: { email: DEFAULT_OWNER_EMAIL },
    update: {},
    create: { email: DEFAULT_OWNER_EMAIL, displayName: "DraftSense user" },
  });
  const league = await prisma.league.upsert({
    where: {
      ownerId_name: { ownerId: owner.id, name: input.league.league.name },
    },
    update: {},
    create: { ownerId: owner.id, sport: "NFL", name: input.league.league.name },
  });
  await prisma.leagueIntegration.upsert({
    where: {
      provider_externalLeagueId: {
        provider: "sleeper",
        externalLeagueId: input.league.league.externalLeagueId,
      },
    },
    update: {
      externalDraftId: input.draft.draftId,
      lastSyncedAt: input.draft.retrievedAt,
      leagueId: league.id,
    },
    create: {
      provider: "sleeper",
      externalLeagueId: input.league.league.externalLeagueId,
      externalDraftId: input.draft.draftId,
      lastSyncedAt: input.draft.retrievedAt,
      leagueId: league.id,
    },
  });
  const scoring = await prisma.scoringFormat.upsert({
    where: {
      sport_name_version: {
        sport: "NFL",
        name: `Sleeper ${input.league.league.name}`,
        version: 1,
      },
    },
    update: { rules: input.league.scoringRules as Prisma.InputJsonValue },
    create: {
      sport: "NFL",
      name: `Sleeper ${input.league.league.name}`,
      version: 1,
      rules: input.league.scoringRules as Prisma.InputJsonValue,
    },
  });
  const latestDataset = await prisma.projectionDataset.findFirst({
    where: { sport: "NFL" },
    orderBy: { publishedAt: "desc" },
  });
  // A user should be able to connect Sleeper before the paid projection feed is ready.
  // This placeholder is replaced by a real, pinned dataset on the next session refresh.
  const dataset =
    latestDataset ??
    (await prisma.projectionDataset.upsert({
      where: {
        sport_source_version: {
          sport: "NFL",
          source: "draftsense-placeholder",
          version: "waiting-for-projections",
        },
      },
      update: {},
      create: {
        sport: "NFL",
        source: "draftsense-placeholder",
        version: "waiting-for-projections",
      },
    }));
  const teamCount = Math.max(
    input.draft.teams.length,
    ...input.draft.picks.map((pick) => Number(pick.rosterId)),
    2,
  );
  const settings = {
    rosterPositions: input.league.rosterPositions,
    scoringRules: input.league.scoringRules,
    source: {
      provider: "sleeper",
      leagueId: input.league.league.externalLeagueId,
      draftId: input.draft.draftId,
      syncedAt: input.draft.retrievedAt.toISOString(),
    },
  };
  const existing = await prisma.draftSession.findFirst({
    where: { leagueId: league.id, status: { not: "COMPLETE" } },
    orderBy: { id: "desc" },
  });
  const session = existing
    ? await prisma.draftSession.update({
        where: { id: existing.id },
        data: {
          datasetId: dataset.id,
          scoringFormatId: scoring.id,
          teamCount,
          settings: settings as Prisma.InputJsonValue,
        },
      })
    : await prisma.draftSession.create({
        data: {
          leagueId: league.id,
          ownerId: owner.id,
          datasetId: dataset.id,
          scoringFormatId: scoring.id,
          sport: "NFL",
          status: input.draft.status === "complete" ? "COMPLETE" : "LIVE",
          draftType: "SNAKE",
          teamCount,
          settings: settings as Prisma.InputJsonValue,
        },
      });
  await prisma.$transaction(
    Array.from({ length: teamCount }, (_, index) => {
      const slot = index + 1;
      const sourceTeam = input.draft.teams.find((team) => team.slot === slot);
      return prisma.draftTeam.upsert({
        where: { sessionId_slot: { sessionId: session.id, slot } },
        update: { name: sourceTeam?.name ?? `Team ${slot}` },
        create: { sessionId: session.id, slot, name: sourceTeam?.name ?? `Team ${slot}` },
      });
    }),
  );
  // Only canonical identities can become draft picks. Unknown provider players remain visible
  // upstream and can be corrected manually, rather than creating an invalid local player.
  const teams = await prisma.draftTeam.findMany({ where: { sessionId: session.id } });
  const identityRows = await prisma.playerExternalIdentity.findMany({
    where: {
      provider: "sleeper",
      externalId: { in: input.draft.picks.map((pick) => pick.externalPlayerId) },
    },
  });
  const playerByExternalId = new Map(identityRows.map((identity) => [identity.externalId, identity.playerId]));
  const teamByRosterId = new Map(
    input.draft.teams
      .filter((team) => team.externalRosterId)
      .map((team) => [team.externalRosterId as string, teams.find((item) => item.slot === team.slot)?.id]),
  );
  const importedPicks = [...input.draft.picks]
    .sort((a, b) => a.overallPick - b.overallPick)
    .flatMap((pick) => {
      const playerId = playerByExternalId.get(pick.externalPlayerId);
      const teamId = teamByRosterId.get(pick.rosterId);
      return playerId && teamId ? [{ ...pick, playerId, teamId }] : [];
    });
  const currentPicks = await prisma.draftPick.findMany({ where: { sessionId: session.id } });
  const currentOverallPick = Math.max(0, ...currentPicks.map((pick) => pick.overallPick));
  const newImportedPicks: typeof importedPicks = [];
  for (const pick of importedPicks) {
    if (pick.overallPick !== currentOverallPick + newImportedPicks.length + 1) break;
    newImportedPicks.push(pick);
  }
  if (newImportedPicks.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.draftPick.createMany({
        data: newImportedPicks.map((pick) => ({
          sessionId: session.id,
          overallPick: pick.overallPick,
          round: Math.ceil(pick.overallPick / teamCount),
          teamId: pick.teamId,
          playerId: pick.playerId,
          source: "SLEEPER",
        })),
        skipDuplicates: true,
      });
      await tx.draftSession.update({
        where: { id: session.id },
        data: { version: currentPicks.length + newImportedPicks.length },
      });
    });
  }
  return getDraftSession(session.id);
}
export async function getDraftSession(id: string) {
  return prisma.draftSession.findUnique({
    where: { id },
    include: {
      teams: { orderBy: { slot: "asc" } },
      picks: {
        orderBy: { overallPick: "asc" },
        include: { player: true, team: true },
      },
      dataset: true,
      scoringFormat: true,
    },
  });
}
export async function draftablePlayers(sessionId: string) {
  const session = await prisma.draftSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { picks: true },
  });
  const projections = await prisma.playerProjection.findMany({
    where: {
      datasetId: session.datasetId,
      player: {
        sport: "NFL",
        NOT: { id: { in: session.picks.map((pick) => pick.playerId) } },
      },
    },
    include: { player: true },
    take: 250,
    orderBy: { projectedPoints: "desc" },
  });
  const scoringRules =
    (session.settings as { scoringRules?: Record<string, number> }).scoringRules ?? {};
  return projections.map((projection) => ({
    ...projection,
    projectedPoints: scoreNflProjection(
      (projection.metadata as { stats?: Record<string, number> } | null)?.stats ?? {},
      scoringRules,
    ),
  }));
}
export { positionSet };
