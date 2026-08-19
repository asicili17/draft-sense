import { describe, expect, it } from "vitest";
import { candidateFillsStarter, evaluateStarterRoster, starterDemandByPosition } from "./index";

describe("roster construction", () => {
  const standard = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"];

  it("allocates restricted slots before FLEX slots", () => {
    const state = evaluateStarterRoster(standard, [
      { id: "qb", positions: ["QB"] },
      { id: "rb-1", positions: ["RB"] },
      { id: "rb-2", positions: ["RB"] },
      { id: "wr-1", positions: ["WR"] },
      { id: "wr-2", positions: ["WR"] },
      { id: "te", positions: ["TE"] },
      { id: "wr-3", positions: ["WR"] },
    ]);

    expect(state.openSlots).toHaveLength(0);
    expect(state.assignments.find((assignment) => assignment.playerId === "te")?.slot.label).toBe(
      "TE",
    );
  });

  it("recognizes that a WR fills an open WR/flex starter while QB2 does not", () => {
    const roster = [{ id: "qb-1", positions: ["QB"] }];
    expect(
      candidateFillsStarter(standard, roster, { id: "wr-1", positions: ["WR"] }).fillsStarter,
    ).toBe(true);
    expect(
      candidateFillsStarter(standard, roster, { id: "qb-2", positions: ["QB"] }).fillsStarter,
    ).toBe(false);
  });

  it("treats superflex as a valid QB2 starter need", () => {
    const result = candidateFillsStarter(
      ["QB", "SUPER_FLEX", "RB", "WR", "TE"],
      [{ id: "qb-1", positions: ["QB"] }],
      { id: "qb-2", positions: ["QB"] },
    );
    expect(result.fillsStarter).toBe(true);
  });

  it("distributes FLEX demand across its eligible positions", () => {
    expect(starterDemandByPosition(["QB", "RB", "WR", "FLEX"], 12)).toEqual({
      QB: 12,
      RB: 16,
      WR: 16,
      TE: 4,
      K: 0,
      DST: 0,
    });
  });
});
