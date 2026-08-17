import { afterEach, describe, expect, it, vi } from "vitest";
import { SleeperLeagueProvider } from "./sleeper";

describe("SleeperLeagueProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves draft settings and applies traded-pick ownership to the schedule", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/picks")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/traded_picks"))
        return new Response(JSON.stringify([{ round: 2, roster_id: 10, owner_id: 20 }]), {
          status: 200,
        });
      if (url.endsWith("/users")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(
        JSON.stringify({
          type: "snake",
          settings: { teams: 2, rounds: 2, pick_timer: 90 },
          slot_to_roster_id: { "1": 10, "2": 20 },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetch);

    const snapshot = await new SleeperLeagueProvider().getDraftSnapshot({
      draftId: "draft-1",
      leagueId: "league-1",
    });

    expect(snapshot).toMatchObject({
      type: "snake",
      settings: { teams: 2, rounds: 2, pickTimer: 90 },
      slotToRosterId: { "1": "10", "2": "20" },
      tradedPicks: [{ round: 2, originalRosterId: "10", currentRosterId: "20" }],
      pickSchedule: [
        { overallPick: 1, round: 1, draftSlot: 1, rosterId: "10" },
        { overallPick: 2, round: 1, draftSlot: 2, rosterId: "20" },
        { overallPick: 3, round: 2, draftSlot: 2, rosterId: "20" },
        { overallPick: 4, round: 2, draftSlot: 1, rosterId: "20" },
      ],
    });
  });
});
