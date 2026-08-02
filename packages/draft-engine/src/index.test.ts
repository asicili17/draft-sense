import { expect, test } from "vitest";
import { recordPick, teamForOverallPick } from "./index";
test("snake order reverses each round", () => { expect(teamForOverallPick(1, 3)).toBe(1); expect(teamForOverallPick(4, 3)).toBe(3); });
test("a pick advances the session", () => expect(recordPick({ teamCount: 2, version: 0, picks: [] }, { overallPick: 1, teamSlot: 1, playerId: "p1" }, 0).version).toBe(1));
