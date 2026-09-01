import { describe, expect, it } from "vitest";
import { recommend } from "./index";

const standardRoster = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST", "BN"];

describe("recommend", () => {
  it("excludes drafted players", () => {
    const results = recommend({
      players: [
        { id: "taken", name: "Taken", position: "RB", projectedPoints: 200 },
        { id: "free", name: "Free", position: "RB", projectedPoints: 190 },
      ],
      draftedPlayerIds: ["taken"],
      rosterPositions: ["RB"],
      roster: [],
    });
    expect(results.map((item) => item.playerId)).toEqual(["free"]);
  });

  it("prefers a needed WR over QB2 when the roster has no WR", () => {
    const results = recommend({
      players: [
        { id: "qb-2", name: "QB Two", position: "QB", projectedPoints: 320 },
        { id: "wr-1", name: "WR One", position: "WR", projectedPoints: 250 },
        { id: "rb-1", name: "RB One", position: "RB", projectedPoints: 250 },
      ],
      draftedPlayerIds: [],
      rosterPositions: standardRoster,
      roster: ["QB"],
      teamCount: 12,
      currentOverallPick: 25,
      totalRounds: 15,
    });
    expect(results.map((item) => item.playerId)).not.toContain("qb-2");
    expect(results.some((item) => item.playerId === "wr-1")).toBe(true);
  });

  it("does not recommend K or DST during the early skill-position build", () => {
    const results = recommend({
      players: [
        { id: "k", name: "Kicker", position: "K", projectedPoints: 170 },
        { id: "dst", name: "Defense", position: "DST", projectedPoints: 150 },
        { id: "wr", name: "Wide Receiver", position: "WR", projectedPoints: 220 },
      ],
      draftedPlayerIds: [],
      rosterPositions: standardRoster,
      roster: ["QB", "RB"],
      teamCount: 12,
      currentOverallPick: 24,
      totalRounds: 15,
    });
    expect(results.map((item) => item.playerId)).toEqual(["wr"]);
  });

  it("allows QB2 to fill a superflex starter", () => {
    const results = recommend({
      players: [
        { id: "qb-2", name: "QB Two", position: "QB", projectedPoints: 300 },
        { id: "wr-1", name: "WR One", position: "WR", projectedPoints: 180 },
      ],
      draftedPlayerIds: [],
      rosterPositions: ["QB", "SUPER_FLEX", "RB", "WR", "TE", "BN"],
      roster: ["QB", "RB", "WR", "TE"],
      teamCount: 12,
      currentOverallPick: 45,
      totalRounds: 15,
    });
    expect(results[0]?.playerId).toBe("qb-2");
    expect(results[0]?.reason).toContain("SUPER FLEX");
  });

  it("prioritizes a needed player who is unlikely to reach the next pick", () => {
    const results = recommend({
      players: [
        {
          id: "wr-now",
          name: "WR Now",
          position: "WR",
          projectedPoints: 250,
          adp: 35,
          tier: 1,
          rankStdDev: 8,
        },
        {
          id: "rb-wait",
          name: "RB Wait",
          position: "RB",
          projectedPoints: 265,
          adp: 70,
          tier: 1,
          rankStdDev: 8,
        },
      ],
      draftedPlayerIds: [],
      rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
      roster: ["QB", "TE"],
      teamCount: 12,
      currentOverallPick: 32,
      nextOverallPick: 56,
      totalRounds: 15,
    });

    expect(results[0]?.playerId).toBe("wr-now");
    expect(results[0]?.factors.availability).toBeLessThan(0.1);
    expect(results[0]?.reason).toContain("Take now");
  });

  it("rewards a player only after they have actually fallen past ADP", () => {
    const [result] = recommend({
      players: [{ id: "falling", name: "Falling", position: "WR", projectedPoints: 220, adp: 20 }],
      draftedPlayerIds: [],
      rosterPositions: ["WR"],
      roster: [],
      currentOverallPick: 40,
      nextOverallPick: 50,
    });
    expect(result?.factors.adpValue).toBe(1);
  });

  it("uses roster simulation outcomes to break otherwise close choices", () => {
    const results = recommend({
      players: [
        { id: "wr", name: "WR", position: "WR", projectedPoints: 220 },
        { id: "rb", name: "RB", position: "RB", projectedPoints: 220 },
      ],
      draftedPlayerIds: [],
      rosterPositions: ["RB", "WR"],
      roster: [],
      simulation: [
        { playerId: "wr", expectedStarterValue: 400, downsideStarterValue: 380, starterCompletionProbability: 1 },
        { playerId: "rb", expectedStarterValue: 360, downsideStarterValue: 330, starterCompletionProbability: 0.8 },
      ],
    });
    expect(results[0]?.playerId).toBe("wr");
    expect(results[0]?.reason).toContain("Simulation projects");
  });
});
