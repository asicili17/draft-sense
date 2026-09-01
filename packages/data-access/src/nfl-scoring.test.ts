import { describe, expect, it } from "vitest";
import { scoreNflProjection } from "./nfl-scoring";

describe("scoreNflProjection", () => {
  it("scores the same raw stat line differently for standard, half-PPR, and PPR", () => {
    const stats = {
      rush_yd: 800,
      rush_td: 8,
      rec: 60,
      rec_yd: 500,
      rec_td: 3,
      fumble_lost: 2,
    };

    const commonRules = {
      rush_yd: 0.1,
      rush_td: 6,
      rec_yd: 0.1,
      rec_td: 6,
      fumble_lost: -2,
    };

    expect(scoreNflProjection(stats, commonRules)).toBe(192);
    expect(scoreNflProjection(stats, { ...commonRules, rec: 0.5 })).toBe(222);
    expect(scoreNflProjection(stats, { ...commonRules, rec: 1 })).toBe(252);
  });

  it("uses normalized two-point conversion fields", () => {
    expect(scoreNflProjection({ "2pt_tds": 2 }, { two_pt: 2 })).toBe(4);
  });
});
