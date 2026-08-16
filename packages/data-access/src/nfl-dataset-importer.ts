import type { AdpImport, ProjectionImport } from "@draft-sense/providers";
import type { Position } from "@prisma/client";
import { prisma } from "./prisma";

const validPositions = new Set(["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"]);
const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const projectedPoints = (stats: Readonly<Record<string, number>>) =>
  stats.fantasyPoints ?? stats.fantasy_points ?? stats.fantasy_points_ppr ?? 0;

export async function importNflDataset(input: { projections: ProjectionImport; adp: AdpImport }) {
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
    const player = identity
      ? await prisma.player.update({
          where: { id: identity.playerId },
          data: {
            fullName: projected.fullName,
            team: projected.team ?? null,
            positions: [position],
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
        adp: adpByName.get(normalizeName(projected.fullName)) ?? null,
        metadata: { stats: projected.stats },
      },
      create: {
        datasetId: dataset.id,
        playerId: player.id,
        scoringFormatId: scoring.id,
        projectedPoints: projectedPoints(projected.stats),
        adp: adpByName.get(normalizeName(projected.fullName)) ?? null,
        metadata: { stats: projected.stats },
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
