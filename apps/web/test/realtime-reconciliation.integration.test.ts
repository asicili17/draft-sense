import { describe, expect, it } from "vitest";
import { shouldRefetchForRealtimeEvent } from "../features/draft/realtime";

const event = (type: "connected" | "draft.updated" | "recommendations.updated" | "simulation.updated", sessionVersion: number) => ({
  type,
  sessionId: "session-1",
  sessionVersion,
});

describe("realtime client reconciliation", () => {
  it("ignores duplicate and stale draft updates", () => {
    expect(shouldRefetchForRealtimeEvent(event("draft.updated", 4), "session-1", 4)).toBe(false);
    expect(shouldRefetchForRealtimeEvent(event("draft.updated", 3), "session-1", 4)).toBe(false);
  });

  it("refetches after a version gap", () => {
    expect(shouldRefetchForRealtimeEvent(event("draft.updated", 6), "session-1", 4)).toBe(true);
  });

  it("accepts derived results for the current board version but ignores other sessions", () => {
    expect(shouldRefetchForRealtimeEvent(event("recommendations.updated", 4), "session-1", 4)).toBe(
      true,
    );
    expect(
      shouldRefetchForRealtimeEvent(
        { ...event("simulation.updated", 5), sessionId: "session-2" },
        "session-1",
        4,
      ),
    ).toBe(false);
  });
});
