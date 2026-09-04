import { describe, expect, it } from "vitest";
import { runRosterSimulation } from "./index";

describe("runRosterSimulation", () => {
  it("models whether a candidate survives until the user's next pick", () => {
    const result = runRosterSimulation({
      candidates: [{ id: "wr", position: "WR", positions: ["WR"], projectedPoints: 220, adp: 2 }],
      playerPool: [
        { id: "wr", position: "WR", positions: ["WR"], projectedPoints: 220, adp: 2 },
        { id: "rb", position: "RB", positions: ["RB"], projectedPoints: 210, adp: 10 },
        { id: "wr-2", position: "WR", positions: ["WR"], projectedPoints: 200, adp: 12 },
        { id: "wr-3", position: "WR", positions: ["WR"], projectedPoints: 190, adp: 14 },
      ],
      teams: [
        {
          id: "user",
          roster: [{ id: "user-qb", position: "QB", positions: ["QB"], projectedPoints: 280 }],
        },
        {
          id: "opponent",
          roster: [{ id: "op-qb", position: "QB", positions: ["QB"], projectedPoints: 275 }],
        },
      ],
      userTeamId: "user",
      rosterPositions: ["QB", "RB", "WR"],
      futurePickTeamIds: ["opponent", "user", "opponent", "user"],
      currentOverallPick: 1,
      trials: 100,
      seed: "simulation-test",
    });

    expect(result[0]?.availableAtNextPickProbability).toBeLessThan(1);
    expect(result[0]?.expectedStarterValue).toBeGreaterThan(280);
    expect(result[0]?.starterCompletionProbability).toBeGreaterThan(0);
  });

  it("credits bench players who preserve lineup value when a starter is unavailable", () => {
    const result = runRosterSimulation({
      candidates: [
        { id: "rb-cover", position: "RB", positions: ["RB"], projectedPoints: 190 },
        { id: "qb-depth", position: "QB", positions: ["QB"], projectedPoints: 260 },
      ],
      playerPool: [
        { id: "rb-cover", position: "RB", positions: ["RB"], projectedPoints: 190 },
        { id: "qb-depth", position: "QB", positions: ["QB"], projectedPoints: 260 },
      ],
      teams: [
        {
          id: "user",
          roster: [
            { id: "rb-starter", position: "RB", positions: ["RB"], projectedPoints: 210 },
            { id: "wr-starter", position: "WR", positions: ["WR"], projectedPoints: 200 },
          ],
        },
      ],
      userTeamId: "user",
      rosterPositions: ["RB", "WR", "BN"],
      futurePickTeamIds: ["user"],
      currentOverallPick: 10,
      trials: 20,
      seed: "coverage-test",
    });

    const rbCover = result.find((item) => item.playerId === "rb-cover");
    const qbDepth = result.find((item) => item.playerId === "qb-depth");
    expect(rbCover?.expectedStarterValue).toBeGreaterThan(qbDepth?.expectedStarterValue ?? 0);
  });
});
