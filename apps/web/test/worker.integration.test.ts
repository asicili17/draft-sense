import { prisma } from "@draft-sense/data-access";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { executeJob } from "../server/jobs/worker";
import { clearDatabase, createDraftFixture } from "./database";

describe("versioned draft workers", () => {
  beforeEach(clearDatabase);
  afterAll(() => prisma.$disconnect());

  it("discards a stale recommendation job before it writes a snapshot", async () => {
    const { session } = await createDraftFixture();

    await executeJob({
      type: "recommendations.recompute",
      sessionId: session.id,
      sessionVersion: session.version + 1,
    });

    await expect(
      prisma.recommendationSnapshot.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(0);
  });

  it("discards a stale simulation job before it writes a result", async () => {
    const { session } = await createDraftFixture();

    await executeJob({
      type: "simulation.run",
      sessionId: session.id,
      sessionVersion: session.version + 1,
    });

    await expect(prisma.simulationRun.count({ where: { sessionId: session.id } })).resolves.toBe(0);
  });
});
