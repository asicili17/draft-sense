import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { DraftSnapshot, LeagueSnapshot } from "@draft-sense/providers";
import { importSleeperLeague } from "./draft-session-service";
import { prisma } from "./prisma";

async function clearDatabase() {
  await prisma.outboxEvent.deleteMany();
  await prisma.userDraftTeamSelection.deleteMany();
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
    type: "snake",
    settings: { teams: 2, rounds: 16, pickTimer: 90 },
    slotToRosterId: { "1": "roster-1", "2": "roster-2" },
    pickSchedule: [
      { overallPick: 1, round: 1, draftSlot: 1, rosterId: "roster-1" },
      { overallPick: 2, round: 1, draftSlot: 2, rosterId: "roster-2" },
    ],
    tradedPicks: [{ round: 2, originalRosterId: "roster-1", currentRosterId: "roster-2" }],
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

  it("rolls back the import when the selected Sleeper team is invalid", async () => {
    const owner = await prisma.user.create({
      data: { email: "failed-import@draftsense.test", displayName: "Failed import owner" },
    });

    await expect(
      importSleeperLeague({ ...source, ownerId: owner.id, selectedTeamSlot: 99 }),
    ).rejects.toThrow("selected Sleeper team");
    await expect(prisma.league.count()).resolves.toBe(0);
    await expect(prisma.draftSession.count()).resolves.toBe(0);
    await expect(prisma.draftTeam.count()).resolves.toBe(0);
  });

  it("creates a draft session from a normalized provider snapshot", async () => {
    const owner = await prisma.user.create({
      data: { email: "import-owner@draftsense.test", displayName: "Import owner" },
    });
    const player = await prisma.player.create({
      data: { sport: "NFL", fullName: "Imported player", positions: ["QB"] },
    });
    await prisma.playerExternalIdentity.create({
      data: { playerId: player.id, provider: "sleeper", externalId: "sleeper-player-1" },
    });

    const session = await importSleeperLeague({
      ...source,
      ownerId: owner.id,
      selectedTeamSlot: 1,
    });

    expect(session).toMatchObject({ status: "LIVE", teamCount: 2, version: 1 });
    expect(session?.teams).toHaveLength(2);
    expect(session?.picks).toHaveLength(1);
    expect(session?.settings).toMatchObject({
      draft: {
        settings: { teams: 2, rounds: 16, pickTimer: 90 },
        pickSchedule: [{ overallPick: 1, rosterId: "roster-1" }],
        tradedPicks: [{ round: 2, currentRosterId: "roster-2" }],
      },
    });
    await expect(prisma.leagueIntegration.findFirstOrThrow()).resolves.toMatchObject({
      externalDraftId: "draft-1",
    });
  });

  it("links a Sleeper pick to an unambiguous canonical player", async () => {
    const owner = await prisma.user.create({
      data: { email: "matched-import@draftsense.test", displayName: "Matched import owner" },
    });
    await prisma.player.create({
      data: { sport: "NFL", fullName: "Sleeper Match", team: "DET", positions: ["RB"] },
    });
    const session = await importSleeperLeague({
      ...source,
      ownerId: owner.id,
      selectedTeamSlot: 1,
      draft: {
        ...source.draft,
        picks: [
          {
            overallPick: 1,
            externalPlayerId: "sleeper-match",
            rosterId: "roster-1",
            fullName: "Sleeper Match",
            team: "DET",
            position: "RB",
          },
        ],
      },
    });
    expect(session?.picks).toHaveLength(1);
    await expect(
      prisma.playerExternalIdentity.findUniqueOrThrow({
        where: { provider_externalId: { provider: "sleeper", externalId: "sleeper-match" } },
      }),
    ).resolves.toMatchObject({ provider: "sleeper" });
  });

  it("refreshes provider state without replacing existing manual picks", async () => {
    const owner = await prisma.user.create({
      data: { email: "manual-owner@draftsense.test", displayName: "Manual owner" },
    });
    const player = await prisma.player.create({
      data: { sport: "NFL", fullName: "Manual player", positions: ["QB"] },
    });
    const session = await importSleeperLeague({
      ...source,
      ownerId: owner.id,
      selectedTeamSlot: 1,
      draft: { ...source.draft, picks: [] },
    });
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
      ownerId: owner.id,
      selectedTeamSlot: 1,
      draft: { ...source.draft, picks: [] },
    });

    expect(refreshed?.picks).toHaveLength(1);
    expect(refreshed?.picks[0]).toMatchObject({ source: "MANUAL", playerId: player.id });
  });
});
