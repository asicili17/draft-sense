import {
  matchPlayer,
  type AdpImport,
  type MarketRankingImport,
  type ProjectionImport,
} from "@draft-sense/providers";
import type { Position } from "@prisma/client";
import { prisma } from "./prisma";

const validPositions = new Set(["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"]);
const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const projectedPoints = (stats: Readonly<Record<string, number>>) =>
  stats.fantasyPoints ?? stats.fantasy_points ?? stats.fantasy_points_ppr ?? 0;

type StoredMarketProfile = {
  source: string;
  retrievedAt: string;
  adp?: number;
  ecr?: number;
  tier?: number;
  rankStdDev?: number;
};

export async function importNflDataset(input: {
  projections: ProjectionImport;
  adp: AdpImport;
  marketRankings?: readonly MarketRankingImport[];
}) {
  // FantasyPros identifies a feed by week, but its projections can change within
  // that week. A daily version makes each production refresh an immutable input
  // for recommendation snapshots.
  const version = `${input.projections.sourceVersion ?? "snapshot"}:${input.projections.retrievedAt.toISOString().slice(0, 10)}`;
  const dataset = await prisma.projectionDataset.upsert({
    where: { sport_source_version: { sport: "NFL", source: input.projections.source, version } },
    update: {},
    create: { sport: "NFL", source: input.projections.source, version },
  });
  const scoring = await prisma.scoringFormat.upsert({
    where: { sport_name_version: { sport: "NFL", name: "DraftSense default", version: 1 } },
    update: {},
    create: { sport: "NFL", name: "DraftSense default", version: 1, rules: {} },
  });
  const adpByName = new Map(
    input.adp.players.map((player) => [normalizeName(player.fullName), player.adp]),
  );
  const marketByScoring = new Map<string, Map<string, StoredMarketProfile>>(
    (input.marketRankings ?? []).map((ranking) => [
      ranking.scoring,
      new Map(
        ranking.players.map((player) => [
          normalizeName(player.fullName),
          {
            source: ranking.source,
            retrievedAt: ranking.retrievedAt.toISOString(),
            ...(player.adp === undefined ? {} : { adp: player.adp }),
            ...(player.ecr === undefined ? {} : { ecr: player.ecr }),
            ...(player.tier === undefined ? {} : { tier: player.tier }),
            ...(player.rankStdDev === undefined ? {} : { rankStdDev: player.rankStdDev }),
          },
        ]),
      ),
    ]),
  );
  const candidates = await prisma.player.findMany({
    where: { sport: "NFL" },
    select: { id: true, fullName: true, team: true, positions: true },
  });
  for (const projected of input.projections.players) {
    const position = (
      validPositions.has(projected.position ?? "") ? projected.position! : "WR"
    ) as Position;
    const identity = await prisma.playerExternalIdentity.findUnique({
      where: {
        provider_externalId: {
          provider: input.projections.source,
          externalId: projected.externalPlayerId,
        },
      },
      include: { player: true },
    });
    const existingMatch = identity
      ? undefined
      : matchPlayer(
          { fullName: projected.fullName, team: projected.team, position },
          candidates.map((candidate) => ({
            id: candidate.id,
            fullName: candidate.fullName,
            team: candidate.team ?? undefined,
            position: candidate.positions[0],
          })),
        );
    const player = identity
      ? await prisma.player.update({
          where: { id: identity.playerId },
          data: {
            fullName: projected.fullName,
            team: projected.team ?? null,
            positions: [position],
          },
        })
      : existingMatch?.kind === "matched"
        ? await prisma.player.update({
            where: { id: existingMatch.playerId },
            data: {
              fullName: projected.fullName,
              team: projected.team ?? null,
              positions: [position],
              identities: {
                create: {
                  provider: input.projections.source,
                  externalId: projected.externalPlayerId,
                },
              },
            },
          })
        : await prisma.player.create({
            data: {
              sport: "NFL",
              fullName: projected.fullName,
              team: projected.team ?? null,
              positions: [position],
              identities: {
                create: {
                  provider: input.projections.source,
                  externalId: projected.externalPlayerId,
                },
              },
            },
          });
    if (!identity && existingMatch?.kind !== "matched") {
      candidates.push({
        id: player.id,
        fullName: player.fullName,
        team: player.team,
        positions: player.positions,
      });
    }
    const playerMarkets = Object.fromEntries(
      [...marketByScoring.entries()].flatMap(([scoring, market]) => {
        const profile = market.get(normalizeName(projected.fullName));
        return profile ? [[scoring, profile]] : [];
      }),
    );
    const pprMarket = playerMarkets.ppr;
    const fallbackAdp = adpByName.get(normalizeName(projected.fullName));
    await prisma.playerProjection.upsert({
      where: {
        datasetId_playerId_scoringFormatId: {
          datasetId: dataset.id,
          playerId: player.id,
          scoringFormatId: scoring.id,
        },
      },
      update: {
        projectedPoints: projectedPoints(projected.stats),
        adp: pprMarket?.adp ?? fallbackAdp ?? null,
        metadata: { stats: projected.stats, market: playerMarkets },
      },
      create: {
        datasetId: dataset.id,
        playerId: player.id,
        scoringFormatId: scoring.id,
        projectedPoints: projectedPoints(projected.stats),
        adp: pprMarket?.adp ?? fallbackAdp ?? null,
        metadata: { stats: projected.stats, market: playerMarkets },
      },
    });
  }
  const liveSessions = await prisma.draftSession.findMany({
    where: { sport: "NFL", status: "LIVE", datasetId: { not: dataset.id } },
    select: { id: true, version: true },
  });
  if (liveSessions.length) {
    await prisma.$transaction(
      liveSessions.flatMap((session) => [
        prisma.draftSession.update({ where: { id: session.id }, data: { datasetId: dataset.id } }),
        prisma.outboxEvent.create({
          data: {
            sessionId: session.id,
            type: "recommendations.recompute",
            payload: { sessionVersion: session.version, reason: "projection_dataset_refreshed" },
          },
        }),
      ]),
    );
  }
  return {
    datasetId: dataset.id,
    playerCount: input.projections.players.length,
    refreshedSessions: liveSessions.length,
    version,
  };
}
