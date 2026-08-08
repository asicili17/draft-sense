import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { claimOutboxEvents, markOutboxDelivered, releaseOutboxEvent } from "./outbox";
import { prisma } from "./prisma";

async function sessionId() {
  const user = await prisma.user.create({ data: { email: "outbox@draftsense.test", displayName: "Outbox" } });
  const dataset = await prisma.projectionDataset.create({ data: { sport: "NFL", source: "test", version: crypto.randomUUID() } });
  const scoring = await prisma.scoringFormat.create({ data: { sport: "NFL", name: "test", version: 1, rules: {} } });
  const session = await prisma.draftSession.create({ data: { ownerId: user.id, datasetId: dataset.id, scoringFormatId: scoring.id, sport: "NFL", draftType: "SNAKE", teamCount: 2, settings: {} } });
  return session.id;
}

beforeEach(async () => {
  await prisma.outboxEvent.deleteMany();
  await prisma.draftSession.deleteMany();
  await prisma.scoringFormat.deleteMany();
  await prisma.projectionDataset.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe("durable outbox", () => {
  it("claims only once and marks an event delivered", async () => {
    const id = await sessionId();
    await prisma.outboxEvent.create({ data: { sessionId: id, type: "draft.pick.recorded", payload: {} } });
    const [claimed] = await claimOutboxEvents();
    expect(claimed).toBeDefined();
    if (!claimed) throw new Error("Expected an outbox claim.");
    await markOutboxDelivered(claimed.id, claimed.leaseToken, "message-1");
    await expect(claimOutboxEvents()).resolves.toEqual([]);
  });

  it("dead-letters an event after bounded publish failures", async () => {
    const id = await sessionId();
    const event = await prisma.outboxEvent.create({ data: { sessionId: id, type: "draft.pick.recorded", payload: {}, attempts: 7 } });
    const [claimed] = await claimOutboxEvents();
    if (!claimed) throw new Error("Expected an outbox claim.");
    await releaseOutboxEvent(claimed.id, claimed.leaseToken, new Error("Queue unavailable"));
    await expect(prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).resolves.toMatchObject({ deadLetteredAt: expect.any(Date), lastError: "Queue unavailable" });
  });
});
