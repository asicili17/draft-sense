export class DraftDomainError extends Error {
  constructor(public readonly code: "VERSION_CONFLICT" | "OUT_OF_ORDER" | "PLAYER_TAKEN" | "PICK_NOT_FOUND" | "UNDO_NOT_ALLOWED", message: string) { super(message); this.name = "DraftDomainError"; }
}
export interface DraftPickInput { overallPick: number; teamSlot: number; playerId: string; }
export interface DraftState { teamCount: number; version: number; picks: readonly DraftPickInput[]; }
export function teamForOverallPick(overallPick: number, teamCount: number): number {
  if (!Number.isInteger(overallPick) || overallPick < 1 || teamCount < 2) throw new DraftDomainError("OUT_OF_ORDER", "The draft pick is invalid.");
  const round = Math.floor((overallPick - 1) / teamCount);
  const offset = (overallPick - 1) % teamCount;
  return round % 2 === 0 ? offset + 1 : teamCount - offset;
}
export function recordPick(state: DraftState, input: DraftPickInput, expectedVersion: number): DraftState {
  if (expectedVersion !== state.version) throw new DraftDomainError("VERSION_CONFLICT", "This draft changed. Refresh and try again.");
  const nextPick = state.picks.length + 1;
  if (input.overallPick !== nextPick || input.teamSlot !== teamForOverallPick(nextPick, state.teamCount)) throw new DraftDomainError("OUT_OF_ORDER", "It is not that team's turn.");
  if (state.picks.some((pick) => pick.playerId === input.playerId)) throw new DraftDomainError("PLAYER_TAKEN", "That player has already been drafted.");
  return { ...state, version: state.version + 1, picks: [...state.picks, input] };
}
export function undoLatestPick(state: DraftState, expectedVersion: number): DraftState {
  if (expectedVersion !== state.version) throw new DraftDomainError("VERSION_CONFLICT", "This draft changed. Refresh and try again.");
  if (state.picks.length === 0) throw new DraftDomainError("PICK_NOT_FOUND", "There is no pick to undo.");
  return { ...state, version: state.version + 1, picks: state.picks.slice(0, -1) };
}
