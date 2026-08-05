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

import { NextRequest } from "next/server";
import { GET, PATCH } from "../app/api/v1/draft-sessions/[id]/route";

describe("draft-session authorization", () => {
  beforeEach(async () => {
    actor.userId = "user_integration";
    await clearDatabase();
  });
  afterAll(() => prisma.$disconnect());

  it("rejects an unauthenticated session request", async () => {
    const { session } = await createDraftFixture();
    actor.userId = null;

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("allows the owner to read a session", async () => {
    const { session } = await createDraftFixture();

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { id: session.id } });
  });

  it("prevents a different user from reading a session", async () => {
    const { session } = await createDraftFixture();
    actor.userId = "user_not_a_member";

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: session.id }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("lets the owner change their selected draft team", async () => {
    const { session } = await createDraftFixture();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/v1/draft-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectedTeamId: session.teams[1]?.id }),
      }),
      { params: Promise.resolve({ id: session.id }) },
    );

    expect(response.status).toBe(200);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { clerkUserId: "user_integration" },
    });
    await expect(
      prisma.userDraftTeamSelection.findUniqueOrThrow({
        where: { userId_sessionId: { userId: owner.id, sessionId: session.id } },
      }),
    ).resolves.toMatchObject({ teamId: session.teams[1]?.id });
  });
});
