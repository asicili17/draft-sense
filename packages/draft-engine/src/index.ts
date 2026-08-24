export class DraftDomainError extends Error {
  constructor(
    public readonly code:
      | "VERSION_CONFLICT"
      | "OUT_OF_ORDER"
      | "PLAYER_TAKEN"
      | "PICK_NOT_FOUND"
      | "UNDO_NOT_ALLOWED"
      | "ROSTER_ILLEGAL",
    message: string,
  ) {
    super(message);
    this.name = "DraftDomainError";
  }
}
export interface DraftPickInput {
  overallPick: number;
  teamSlot: number;
  playerId: string;
}
export interface DraftState {
  teamCount: number;
  version: number;
  picks: readonly DraftPickInput[];
}
export interface RosterPick {
  position: string;
  rosterPositions: readonly string[];
  draftedPositions: readonly string[];
}

/** Ensures a manual pick cannot make the imported lineup impossible to fill. */
export function validateRosterPick({
  position,
  rosterPositions,
  draftedPositions,
}: RosterPick): void {
  const required = rosterPositions.filter((slot) => slot === position).length;
  const flexSlots = rosterPositions.filter((slot) =>
    ["FLEX", "SUPER_FLEX", "WRRB_FLEX", "REC_FLEX"].includes(slot),
  ).length;
  const alreadyDrafted = draftedPositions.filter((drafted) => drafted === position).length;
  if (required === 0 && flexSlots === 0)
    throw new DraftDomainError("ROSTER_ILLEGAL", "That position is not eligible for this roster.");
  // A position may fill its named slots plus a flex slot. Bench slots intentionally remain unrestricted.
  if (alreadyDrafted >= required + flexSlots)
    throw new DraftDomainError("ROSTER_ILLEGAL", "That roster has no eligible slot remaining.");
}
export function teamForOverallPick(overallPick: number, teamCount: number): number {
  if (!Number.isInteger(overallPick) || overallPick < 1 || teamCount < 2)
    throw new DraftDomainError("OUT_OF_ORDER", "The draft pick is invalid.");
  const round = Math.floor((overallPick - 1) / teamCount);
  const offset = (overallPick - 1) % teamCount;
  return round % 2 === 0 ? offset + 1 : teamCount - offset;
}
export interface ScheduledDraftPick {
  overallPick: number;
  rosterId: string;
}
/** Returns the next pick for a team, preferring Sleeper's traded-pick schedule when present. */
export function nextPickForTeam(input: {
  currentOverallPick: number;
  teamSlot: number;
  teamCount: number;
  userRosterId?: string | undefined;
  pickSchedule?: readonly ScheduledDraftPick[] | undefined;
}): number {
  if (input.userRosterId && input.pickSchedule) {
    const scheduledPick = input.pickSchedule.find(
      (pick) =>
        pick.overallPick >= input.currentOverallPick && pick.rosterId === input.userRosterId,
    );
    if (scheduledPick) return scheduledPick.overallPick;
  }
  let overallPick = input.currentOverallPick;
  while (teamForOverallPick(overallPick, input.teamCount) !== input.teamSlot) overallPick += 1;
  return overallPick;
}
export function recordPick(
  state: DraftState,
  input: DraftPickInput,
  expectedVersion: number,
): DraftState {
  if (expectedVersion !== state.version)
    throw new DraftDomainError("VERSION_CONFLICT", "This draft changed. Refresh and try again.");
  const nextPick = state.picks.length + 1;
  if (
    input.overallPick !== nextPick ||
    input.teamSlot !== teamForOverallPick(nextPick, state.teamCount)
  )
    throw new DraftDomainError("OUT_OF_ORDER", "It is not that team's turn.");
  if (state.picks.some((pick) => pick.playerId === input.playerId))
    throw new DraftDomainError("PLAYER_TAKEN", "That player has already been drafted.");
  return {
    ...state,
    version: state.version + 1,
    picks: [...state.picks, input],
  };
}
export function undoLatestPick(state: DraftState, expectedVersion: number): DraftState {
  if (expectedVersion !== state.version)
    throw new DraftDomainError("VERSION_CONFLICT", "This draft changed. Refresh and try again.");
  if (state.picks.length === 0)
    throw new DraftDomainError("PICK_NOT_FOUND", "There is no pick to undo.");
  return {
    ...state,
    version: state.version + 1,
    picks: state.picks.slice(0, -1),
  };
}
