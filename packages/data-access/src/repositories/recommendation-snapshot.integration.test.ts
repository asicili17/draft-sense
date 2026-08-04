import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../prisma";

async function clearDatabase() {
  await prisma.outboxEvent.deleteMany();
  await prisma.recommendationSnapshot.deleteMany();
  await prisma.draftPick.deleteMany();
  await prisma.draftTeam.deleteMany();
  await prisma.draftSession.deleteMany();
  await prisma.scoringFormat.deleteMany();
  await prisma.projectionDataset.deleteMany();
  await prisma.user.deleteMany();
}

describe("recommendation snapshot persistence", () => {
  beforeEach(clearDatabase);
  afterAll(() => prisma.$disconnect());

  it("rejects a second snapshot for the same session version and algorithm", async () => {
    const owner = await prisma.user.create({
      data: { email: "snapshot@draftsense.test", displayName: "Snapshot user" },
    });
    const dataset = await prisma.projectionDataset.create({
      data: { sport: "NFL", source: "integration", version: "snapshot-v1" },
    });
    const scoringFormat = await prisma.scoringFormat.create({
      data: { sport: "NFL", name: "Snapshot", version: 1, rules: {} },
    });
    const session = await prisma.draftSession.create({
      data: {
        ownerId: owner.id,
        datasetId: dataset.id,
        scoringFormatId: scoringFormat.id,
        sport: "NFL",
        draftType: "SNAKE",
        teamCount: 2,
        settings: {},
      },
    });
    const snapshot = {
      sessionId: session.id,
      sessionVersion: 0,
      algorithmVersion: "2026.1",
      input: { source: "test" },
      result: { recommendations: [] },
    };

    await prisma.recommendationSnapshot.create({ data: snapshot });
    await expect(prisma.recommendationSnapshot.create({ data: snapshot })).rejects.toMatchObject({
      code: "P2002",
    });
  });
});
