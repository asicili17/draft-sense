import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { DraftSnapshot, LeagueSnapshot } from "@draft-sense/providers";
import { importSleeperLeague } from "./draft-session-service";
import { prisma } from "./prisma";

async function clearDatabase() {
  await prisma.outboxEvent.deleteMany();
  await prisma.recommendationSnapshot.deleteMany();
  await prisma.draftPick.deleteMany();
  await prisma.draftTeam.deleteMany();
  await prisma.draftSession.deleteMany();
  await prisma.playerExternalIdentity.deleteMany();
  await prisma.player.deleteMany();
  await prisma.scoringFormat.deleteMany();
  await prisma.projectionDataset.deleteMany();
  await prisma.leagueIntegration.deleteMany();
  await prisma.league.deleteMany();
  await prisma.user.deleteMany();
}

const source = {
  league: {
    league: {
      provider: "sleeper" as const,
      externalLeagueId: "league-1",
      name: "Integration league",
      season: 2026,
    },
    scoringRules: { rec: 1 },
    rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
  },
  draft: {
    draftId: "draft-1",
    status: "drafting",
    teams: [
      { slot: 1, name: "One", externalRosterId: "roster-1" },
      { slot: 2, name: "Two", externalRosterId: "roster-2" },
    ],
    picks: [{ overallPick: 1, externalPlayerId: "sleeper-player-1", rosterId: "roster-1" }],
    retrievedAt: new Date("2026-08-03T12:00:00.000Z"),
  },
} satisfies { league: LeagueSnapshot; draft: DraftSnapshot };

describe("Sleeper session import", () => {
  beforeEach(clearDatabase);
  afterAll(() => prisma.$disconnect());

  it("creates a draft session from a normalized provider snapshot", async () => {
    const player = await prisma.player.create({
      data: { sport: "NFL", fullName: "Imported player", positions: ["QB"] },
    });
    await prisma.playerExternalIdentity.create({
      data: { playerId: player.id, provider: "sleeper", externalId: "sleeper-player-1" },
    });

    const session = await importSleeperLeague(source);

    expect(session).toMatchObject({ status: "LIVE", teamCount: 2, version: 1 });
    expect(session?.teams).toHaveLength(2);
    expect(session?.picks).toHaveLength(1);
    await expect(prisma.leagueIntegration.findFirstOrThrow()).resolves.toMatchObject({
      externalDraftId: "draft-1",
    });
  });

  it("refreshes provider state without replacing existing manual picks", async () => {
    const player = await prisma.player.create({
      data: { sport: "NFL", fullName: "Manual player", positions: ["QB"] },
    });
    const session = await importSleeperLeague({ ...source, draft: { ...source.draft, picks: [] } });
    const team = session?.teams[0];
    if (!session || !team) throw new Error("Expected imported session and team");
    await prisma.draftPick.create({
      data: {
        sessionId: session.id,
        overallPick: 1,
        round: 1,
        teamId: team.id,
        playerId: player.id,
        source: "MANUAL",
      },
    });
    await prisma.draftSession.update({ where: { id: session.id }, data: { version: 1 } });

    const refreshed = await importSleeperLeague({
      ...source,
      draft: { ...source.draft, picks: [] },
    });

    expect(refreshed?.picks).toHaveLength(1);
    expect(refreshed?.picks[0]).toMatchObject({ source: "MANUAL", playerId: player.id });
  });
});
