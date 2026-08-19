export const NFL_STARTER_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
export type NflStarterPosition = (typeof NFL_STARTER_POSITIONS)[number];

export interface RosterSlot {
  readonly id: string;
  readonly label: string;
  readonly eligiblePositions: readonly NflStarterPosition[];
}

export interface RosterPlayer {
  readonly id: string;
  readonly positions: readonly string[];
}

export interface StarterAssignment {
  readonly slot: RosterSlot;
  readonly playerId: string;
}

export interface RosterState {
  readonly assignments: readonly StarterAssignment[];
  readonly openSlots: readonly RosterSlot[];
  readonly starterSlots: readonly RosterSlot[];
  readonly unsupportedSlots: readonly string[];
  readonly benchSlots: number;
}

const slotEligibility: Readonly<Record<string, readonly NflStarterPosition[]>> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DST: ["DST"],
  DEF: ["DST"],
  FLEX: ["RB", "WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
};

const benchSlots = new Set(["BN", "BENCH", "TAXI", "RESERVE", "IR"]);

const normalizeSlot = (slot: string) => slot.trim().toUpperCase();
const knownPosition = (position: string): position is NflStarterPosition =>
  (NFL_STARTER_POSITIONS as readonly string[]).includes(position);

/** Converts Sleeper roster-position strings into explicit, draftable starter slots. */
export function compileRosterSlots(rosterPositions: readonly string[]): {
  starterSlots: readonly RosterSlot[];
  benchSlots: number;
  unsupportedSlots: readonly string[];
} {
  const starterSlots: RosterSlot[] = [];
  const unsupportedSlots: string[] = [];
  let benchCount = 0;
  for (const rawSlot of rosterPositions) {
    const label = normalizeSlot(rawSlot);
    if (benchSlots.has(label)) {
      benchCount += 1;
      continue;
    }
    const eligiblePositions = slotEligibility[label];
    if (!eligiblePositions) {
      unsupportedSlots.push(rawSlot);
      continue;
    }
    starterSlots.push({
      id: `${label}-${starterSlots.length + 1}`,
      label,
      eligiblePositions,
    });
  }
  return { starterSlots, benchSlots: benchCount, unsupportedSlots };
}

const playerCanFill = (player: RosterPlayer, slot: RosterSlot) =>
  player.positions.some(
    (position) => knownPosition(position) && slot.eligiblePositions.includes(position),
  );

/**
 * Finds a maximum-cardinality assignment. Slots with fewer eligible positions
 * are matched first so a FLEX does not consume a player needed by a QB/TE slot.
 */
export function evaluateStarterRoster(
  rosterPositions: readonly string[],
  players: readonly RosterPlayer[],
): RosterState {
  const compiled = compileRosterSlots(rosterPositions);
  const orderedSlots = [...compiled.starterSlots].sort(
    (left, right) => left.eligiblePositions.length - right.eligiblePositions.length,
  );
  const playerById = new Map(players.map((player) => [player.id, player]));
  const slotByPlayerId = new Map<string, RosterSlot>();

  const assign = (slot: RosterSlot, seenPlayerIds: Set<string>): boolean => {
    for (const player of players) {
      if (seenPlayerIds.has(player.id) || !playerCanFill(player, slot)) continue;
      seenPlayerIds.add(player.id);
      const occupiedSlot = slotByPlayerId.get(player.id);
      if (!occupiedSlot || assign(occupiedSlot, seenPlayerIds)) {
        slotByPlayerId.set(player.id, slot);
        return true;
      }
    }
    return false;
  };

  for (const slot of orderedSlots) assign(slot, new Set());
  const assignments = [...slotByPlayerId.entries()]
    .map(([playerId, slot]) => ({ slot, playerId }))
    .filter((assignment) => playerById.has(assignment.playerId));
  const assignedSlotIds = new Set(assignments.map((assignment) => assignment.slot.id));
  return {
    assignments,
    openSlots: compiled.starterSlots.filter((slot) => !assignedSlotIds.has(slot.id)),
    starterSlots: compiled.starterSlots,
    unsupportedSlots: compiled.unsupportedSlots,
    benchSlots: compiled.benchSlots,
  };
}

export function candidateFillsStarter(
  rosterPositions: readonly string[],
  roster: readonly RosterPlayer[],
  candidate: RosterPlayer,
) {
  const before = evaluateStarterRoster(rosterPositions, roster);
  const after = evaluateStarterRoster(rosterPositions, [...roster, candidate]);
  return {
    before,
    after,
    fillsStarter:
      after.assignments.length > before.assignments.length &&
      after.assignments.some((assignment) => assignment.playerId === candidate.id),
  };
}

/** Estimated league-wide starter demand, allocating flexible slots evenly by eligibility. */
export function starterDemandByPosition(
  rosterPositions: readonly string[],
  teamCount: number,
): Readonly<Record<NflStarterPosition, number>> {
  const demand: Record<NflStarterPosition, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const slot of compileRosterSlots(rosterPositions).starterSlots)
    for (const position of slot.eligiblePositions)
      demand[position] += teamCount / slot.eligiblePositions.length;
  return demand;
}
