import { expect, test } from "vitest";
import {
  DraftDomainError,
  nextPickForTeam,
  recordPick,
  teamForOverallPick,
  validateRosterPick,
} from "./index";
test("snake order reverses each round", () => {
  expect(teamForOverallPick(1, 3)).toBe(1);
  expect(teamForOverallPick(4, 3)).toBe(3);
});
test("a pick advances the session", () =>
  expect(
    recordPick(
      { teamCount: 2, version: 0, picks: [] },
      { overallPick: 1, teamSlot: 1, playerId: "p1" },
      0,
    ).version,
  ).toBe(1));
test("a manual pick cannot exceed eligible roster slots", () => {
  expect(() =>
    validateRosterPick({ position: "QB", rosterPositions: ["QB"], draftedPositions: ["QB"] }),
  ).toThrowError(DraftDomainError);
});
test("uses the imported pick schedule when a pick has been traded", () => {
  expect(
    nextPickForTeam({
      currentOverallPick: 3,
      teamSlot: 1,
      teamCount: 2,
      userRosterId: "roster-2",
      pickSchedule: [
        { overallPick: 3, rosterId: "roster-2" },
        { overallPick: 4, rosterId: "roster-2" },
      ],
    }),
  ).toBe(3);
});
