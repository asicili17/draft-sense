import { describe, expect, it } from "vitest";
import { matchPlayer } from "./player-match";
describe("matchPlayer", () => { it("matches normalized names", () => expect(matchPlayer({ fullName: "A.J. Brown", team: "PHI" }, [{ id: "1", fullName: "AJ Brown", team: "PHI" }])).toEqual({ kind: "matched", playerId: "1" })); it("does not guess ambiguous players", () => expect(matchPlayer({ fullName: "Josh Allen" }, [{ id: "1", fullName: "Josh Allen" }, { id: "2", fullName: "Josh Allen" }]).kind).toBe("ambiguous")); });
