import { prisma } from "@draft-sense/data-access";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/v1/draft-sessions/[id]/picks/route";
import { clearDatabase, createDraftFixture } from "./database";

const postPick = (sessionId: string, body: Record<string, unknown>, idempotencyKey?: string) =>
  POST(
    new NextRequest(`http://localhost/api/v1/draft-sessions/${sessionId}/picks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: sessionId }) },
  );

describe("draft pick API contracts", () => {
  beforeEach(clearDatabase);
  afterAll(() => prisma.$disconnect());

  it("records a pick, increments the version, and writes an outbox event", async () => {
    const { session, firstPlayer } = await createDraftFixture();
    const response = await postPick(session.id, {
      playerId: firstPlayer.id,
      teamSlot: 1,
      expectedVersion: 0,
    });

    expect(response.status).toBe(201);
    expect((await response.json()).data.version).toBe(1);
    await expect(prisma.draftPick.count({ where: { sessionId: session.id } })).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.findFirstOrThrow({ where: { sessionId: session.id } }),
    ).resolves.toMatchObject({
      type: "draft.pick.recorded",
    });
  });

  it("returns a stable version-conflict envelope", async () => {
    const { session, firstPlayer } = await createDraftFixture();
    const response = await postPick(session.id, {
      playerId: firstPlayer.id,
      teamSlot: 1,
      expectedVersion: 3,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VERSION_CONFLICT" } });
  });

  it("replays an idempotent pick without a duplicate pick or outbox event", async () => {
    const { session, firstPlayer } = await createDraftFixture();
    const input = { playerId: firstPlayer.id, teamSlot: 1, expectedVersion: 0 };
    const first = await postPick(session.id, input, "pick-001");
    const replay = await postPick(session.id, input, "pick-001");

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect((await replay.json()).data.version).toBe(1);
    await expect(prisma.draftPick.count({ where: { sessionId: session.id } })).resolves.toBe(1);
    await expect(prisma.outboxEvent.count({ where: { sessionId: session.id } })).resolves.toBe(1);
  });
});
