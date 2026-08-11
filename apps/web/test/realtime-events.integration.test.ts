import { prisma } from "@draft-sense/data-access";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, createDraftFixture } from "./database";

const actor = vi.hoisted(() => ({ userId: "user_integration" as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: actor.userId }),
  currentUser: async () =>
    actor.userId
      ? {
          primaryEmailAddress: { emailAddress: `${actor.userId}@draftsense.test` },
          firstName: "Test",
          lastName: "User",
        }
      : null,
}));

import { GET } from "../app/api/v1/draft-sessions/[id]/events/route";
import { changedSessionEvents } from "../server/realtime/session-events";

describe("draft room SSE events", () => {
  beforeEach(async () => {
    actor.userId = "user_integration";
    await clearDatabase();
  });
  afterAll(() => prisma.$disconnect());

  it("rejects an unauthenticated event-stream request", async () => {
    const { session } = await createDraftFixture();
    actor.userId = null;

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(401);
  });

  it("opens an owner-only stream with a version-only connected payload", async () => {
    const { session } = await createDraftFixture();
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Expected an SSE response body.");
    const first = await reader.read();
    const text = new TextDecoder().decode(first.value);
    expect(text).toContain("event: connected");
    expect(JSON.parse(text.match(/data: (.+)/)?.[1] ?? "{}")).toEqual({
      type: "connected",
      sessionId: session.id,
      sessionVersion: session.version,
    });
    await reader.cancel();
  });

  it("emits only versioned public events for durable-state changes", () => {
    expect(
      changedSessionEvents(
        "session-1",
        {
          sessionVersion: 2,
          recommendationId: "recommendation-1",
          recommendationVersion: 2,
          simulationId: null,
          simulationVersion: null,
        },
        {
          sessionVersion: 3,
          recommendationId: "recommendation-2",
          recommendationVersion: 3,
          simulationId: "simulation-1",
          simulationVersion: 3,
        },
      ),
    ).toEqual([
      { type: "draft.updated", sessionId: "session-1", sessionVersion: 3 },
      { type: "recommendations.updated", sessionId: "session-1", sessionVersion: 3 },
      { type: "simulation.updated", sessionId: "session-1", sessionVersion: 3 },
    ]);
  });
});
