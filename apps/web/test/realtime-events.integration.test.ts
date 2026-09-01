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

import { authorizeDraftChannels } from "../server/realtime/authorization";

describe("draft room SSE events", () => {
  beforeEach(async () => {
    actor.userId = "user_integration";
    await clearDatabase();
  });
  afterAll(() => prisma.$disconnect());

  it("rejects an unauthenticated realtime subscription", async () => {
    const { session } = await createDraftFixture();
    actor.userId = null;

    const response = await authorizeDraftChannels([`draft:${session.id}`]);

    expect(response?.status).toBe(401);
  });

  it("allows an owner to subscribe only to their draft channel", async () => {
    const { session } = await createDraftFixture();
    const response = await authorizeDraftChannels([`draft:${session.id}`]);

    expect(response).toBeUndefined();
  });

  it("rejects a channel that does not name an authorized draft", async () => {
    const response = await authorizeDraftChannels(["admin:all-drafts"]);

    expect(response?.status).toBe(403);
  });
});
