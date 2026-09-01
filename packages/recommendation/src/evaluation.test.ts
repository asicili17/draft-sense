import { describe, expect, it } from "vitest";
import { evaluateRecommendationCases } from "./evaluation";

describe("evaluateRecommendationCases", () => {
  it("reports agreement and observed rank from frozen draft inputs", () => {
    const result = evaluateRecommendationCases([
      {
        id: "pick-1",
        observedPlayerId: "wr",
        input: {
          players: [
            { id: "wr", name: "WR", position: "WR", projectedPoints: 220 },
            { id: "rb", name: "RB", position: "RB", projectedPoints: 200 },
          ],
          draftedPlayerIds: [],
          rosterPositions: ["WR"],
          roster: [],
        },
      },
    ]);
    expect(result.topChoiceAgreement).toBe(1);
    expect(result.meanObservedRank).toBe(1);
    expect(result.results[0]?.recommendedPlayerId).toBe("wr");
  });
});
