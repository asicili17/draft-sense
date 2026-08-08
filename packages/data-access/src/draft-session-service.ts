import type { Position, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { scoreNflProjection } from "./nfl-scoring";
import { matchPlayer, type DraftSnapshot, type LeagueSnapshot } from "@draft-sense/providers";
const positionSet = new Set<Position>(["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"]);
export async function importSleeperLeague(input: {
  league: LeagueSnapshot;
  draft: DraftSnapshot;
  ownerId: string;
  selectedTeamSlot: number;
}) {
  const sessionId = await prisma.$transaction(async (tx) => {
    const existingIntegration = await tx.leagueIntegration.findUnique({
      where: {
        provider_externalLeagueId: {
          provider: "sleeper",
          externalLeagueId: input.league.league.externalLeagueId,
        },
      },
      include: {
        league: {
          include: { owner: { select: { clerkUserId: true } } },
        },
      },
    });
    let league = existingIntegration?.league;
    if (league && league.ownerId !== input.ownerId) {
      if (league.owner.clerkUserId)
        throw new Error("This Sleeper league is already registered to another DraftSense account.");
      league = await tx.league.update({
        where: { id: league.id },
        data: { ownerId: input.ownerId },
        include: { owner: { select: { clerkUserId: true } } },
      });
    }
    if (!league)
      league = await tx.league.create({
        data: { ownerId: input.ownerId, sport: "NFL", name: input.league.league.name },
        include: { owner: { select: { clerkUserId: true } } },
      });
    await tx.leagueIntegration.upsert({
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
    const scoring = await tx.scoringFormat.upsert({
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
    const latestDataset = await tx.projectionDataset.findFirst({
      where: { sport: "NFL" },
      orderBy: { publishedAt: "desc" },
    });
    // A user should be able to connect Sleeper before the paid projection feed is ready.
    // This placeholder is replaced by a real, pinned dataset on the next session refresh.
    const dataset =
      latestDataset ??
      (await tx.projectionDataset.upsert({
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
    const existing = await tx.draftSession.findFirst({
      where: { leagueId: league.id, status: { not: "COMPLETE" } },
      orderBy: { id: "desc" },
    });
    const session = existing
      ? await tx.draftSession.update({
          where: { id: existing.id },
          data: {
            ownerId: input.ownerId,
            datasetId: dataset.id,
            scoringFormatId: scoring.id,
            teamCount,
            settings: settings as Prisma.InputJsonValue,
          },
        })
      : await tx.draftSession.create({
          data: {
            leagueId: league.id,
            ownerId: league.ownerId,
            datasetId: dataset.id,
            scoringFormatId: scoring.id,
            sport: "NFL",
            status: input.draft.status === "complete" ? "COMPLETE" : "LIVE",
            draftType: "SNAKE",
            teamCount,
            settings: settings as Prisma.InputJsonValue,
          },
        });
    await Promise.all(
      Array.from({ length: teamCount }, (_, index) => {
        const slot = index + 1;
        const sourceTeam = input.draft.teams.find((team) => team.slot === slot);
        return tx.draftTeam.upsert({
          where: { sessionId_slot: { sessionId: session.id, slot } },
          update: { name: sourceTeam?.name ?? `Team ${slot}` },
          create: { sessionId: session.id, slot, name: sourceTeam?.name ?? `Team ${slot}` },
        });
      }),
    );
    const selectedTeam = await tx.draftTeam.findUnique({
      where: { sessionId_slot: { sessionId: session.id, slot: input.selectedTeamSlot } },
    });
    if (!selectedTeam) throw new Error("The selected Sleeper team is not available in this draft.");
    await tx.userDraftTeamSelection.upsert({
      where: { userId_sessionId: { userId: input.ownerId, sessionId: session.id } },
      update: { teamId: selectedTeam.id },
      create: { userId: input.ownerId, sessionId: session.id, teamId: selectedTeam.id },
    });
    // Only canonical identities can become draft picks. Unknown provider players remain visible
    // upstream and can be corrected manually, rather than creating an invalid local player.
    const teams = await tx.draftTeam.findMany({ where: { sessionId: session.id } });
    const identityRows = await tx.playerExternalIdentity.findMany({
      where: {
        provider: "sleeper",
        externalId: { in: input.draft.picks.map((pick) => pick.externalPlayerId) },
      },
    });
    const playerByExternalId = new Map(
      identityRows.map((identity) => [identity.externalId, identity.playerId]),
    );
    const unmatchedSleeperPicks = input.draft.picks.filter(
      (pick) => !playerByExternalId.has(pick.externalPlayerId) && pick.fullName,
    );
    if (unmatchedSleeperPicks.length) {
      const candidates = await tx.player.findMany({
        where: { sport: "NFL" },
        select: { id: true, fullName: true, team: true, positions: true },
      });
      for (const pick of unmatchedSleeperPicks) {
        if (!pick.fullName) continue;
        const match = matchPlayer(
          { fullName: pick.fullName, team: pick.team, position: pick.position },
          candidates.map((player) => ({
            id: player.id,
            fullName: player.fullName,
            team: player.team ?? undefined,
            position: player.positions[0],
          })),
        );
        if (match.kind !== "matched") continue;
        await tx.playerExternalIdentity.upsert({
          where: { provider_externalId: { provider: "sleeper", externalId: pick.externalPlayerId } },
          update: {},
          create: { provider: "sleeper", externalId: pick.externalPlayerId, playerId: match.playerId },
        });
        playerByExternalId.set(pick.externalPlayerId, match.playerId);
      }
    }
    const teamByRosterId = new Map(
      input.draft.teams
        .filter((team) => team.externalRosterId)
        .map((team) => [
          team.externalRosterId as string,
          teams.find((item) => item.slot === team.slot)?.id,
        ]),
    );
    const importedPicks = [...input.draft.picks]
      .sort((a, b) => a.overallPick - b.overallPick)
      .flatMap((pick) => {
        const playerId = playerByExternalId.get(pick.externalPlayerId);
        const teamId = teamByRosterId.get(pick.rosterId);
        return playerId && teamId ? [{ ...pick, playerId, teamId }] : [];
      });
    const currentPicks = await tx.draftPick.findMany({ where: { sessionId: session.id } });
    const currentOverallPick = Math.max(0, ...currentPicks.map((pick) => pick.overallPick));
    const newImportedPicks: typeof importedPicks = [];
    for (const pick of importedPicks) {
      if (pick.overallPick !== currentOverallPick + newImportedPicks.length + 1) break;
      newImportedPicks.push(pick);
    }
    if (newImportedPicks.length > 0) {
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
      await tx.outboxEvent.create({
        data: {
          sessionId: session.id,
          type: "draft.pick.recorded",
          payload: {
            source: "sleeper",
            sessionVersion: currentPicks.length + newImportedPicks.length,
            overallPick: newImportedPicks.at(-1)?.overallPick,
          },
        },
      });
    }
    return session.id;
  });
  return getDraftSession(sessionId);
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
