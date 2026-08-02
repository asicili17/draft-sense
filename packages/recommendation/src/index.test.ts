import { expect, test } from "vitest";
import { recommend } from "./index";
test("drafted players are excluded", () => {
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
