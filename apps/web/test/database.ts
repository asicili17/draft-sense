import { prisma } from "@draft-sense/data-access";

export async function clearDatabase() {
  await prisma.outboxEvent.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.recommendationSnapshot.deleteMany();
  await prisma.draftPick.deleteMany();
  await prisma.draftTeam.deleteMany();
  await prisma.draftSession.deleteMany();
  await prisma.playerProjection.deleteMany();
  await prisma.playerExternalIdentity.deleteMany();
  await prisma.player.deleteMany();
  await prisma.scoringFormat.deleteMany();
  await prisma.projectionDataset.deleteMany();
  await prisma.leagueIntegration.deleteMany();
  await prisma.league.deleteMany();
  await prisma.user.deleteMany();
}

export async function createDraftFixture() {
  const owner = await prisma.user.create({
    data: { email: "integration@draftsense.test", displayName: "Integration user" },
  });
  const dataset = await prisma.projectionDataset.create({
    data: { sport: "NFL", source: "integration", version: "v1" },
  });
  const scoringFormat = await prisma.scoringFormat.create({
    data: { sport: "NFL", name: "Integration", version: 1, rules: {} },
  });
  const session = await prisma.draftSession.create({
    data: {
      ownerId: owner.id,
      datasetId: dataset.id,
      scoringFormatId: scoringFormat.id,
      sport: "NFL",
      status: "LIVE",
      draftType: "SNAKE",
      teamCount: 2,
      settings: { rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"] },
      teams: {
        create: [
          { slot: 1, name: "One" },
          { slot: 2, name: "Two" },
        ],
      },
    },
    include: { teams: { orderBy: { slot: "asc" } } },
  });
  const [firstPlayer, secondPlayer] = await Promise.all([
    prisma.player.create({ data: { sport: "NFL", fullName: "First Player", positions: ["QB"] } }),
    prisma.player.create({ data: { sport: "NFL", fullName: "Second Player", positions: ["RB"] } }),
  ]);
  return { session, firstPlayer, secondPlayer };
}
