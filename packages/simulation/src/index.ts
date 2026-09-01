import {
  candidateFillsStarter,
  evaluateStarterRoster,
  type RosterPlayer,
} from "@draft-sense/roster-construction";

export interface SimulationCandidate {
  playerId: string;
  adp?: number | undefined;
  score: number;
}
export interface AvailabilitySummary {
  playerId: string;
  availableProbability: number;
}
export interface DraftSimulationPlayer extends RosterPlayer {
  readonly position: string;
  readonly projectedPoints: number;
  readonly adp?: number | undefined;
  readonly tier?: number | undefined;
}
export interface DraftSimulationTeam {
  readonly id: string;
  readonly roster: readonly DraftSimulationPlayer[];
}
export interface RosterSimulationSummary {
  readonly playerId: string;
  readonly availableAtNextPickProbability: number;
  readonly expectedStarterValue: number;
  readonly downsideStarterValue: number;
  readonly starterCompletionProbability: number;
}

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
const seedNumber = (seed: string) =>
  [...seed].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0);

/** The compact MVP availability approximation retained for callers that only need next-turn odds. */
export function runSimulation(input: {
  candidates: readonly SimulationCandidate[];
  picksUntilNextTurn: number;
  trials: number;
  seed: string;
}): readonly AvailabilitySummary[] {
  const rand = random(seedNumber(input.seed));
  const taken = new Map<string, number>();
  for (let trial = 0; trial < input.trials; trial++)
    for (const candidate of input.candidates) {
      const draftPressure = Math.max(
        0.05,
        Math.min(0.95, (250 - (candidate.adp ?? 180)) / 260 + candidate.score / 200),
      );
      if (rand() < (draftPressure * input.picksUntilNextTurn) / 8)
        taken.set(candidate.playerId, (taken.get(candidate.playerId) ?? 0) + 1);
    }
  return input.candidates.map((candidate) => ({
    playerId: candidate.playerId,
    availableProbability: Number(
      (1 - (taken.get(candidate.playerId) ?? 0) / input.trials).toFixed(3),
    ),
  }));
}

const removePlayer = (players: readonly DraftSimulationPlayer[], playerId: string) =>
  players.filter((player) => player.id !== playerId);
const starterValue = (
  rosterPositions: readonly string[],
  roster: readonly DraftSimulationPlayer[],
) => {
  const state = evaluateStarterRoster(rosterPositions, roster);
  const byId = new Map(roster.map((player) => [player.id, player]));
  return {
    value: state.assignments.reduce(
      (total, assignment) => total + (byId.get(assignment.playerId)?.projectedPoints ?? 0),
      0,
    ),
    complete: state.openSlots.length === 0,
  };
};
const pickUtility = (
  player: DraftSimulationPlayer,
  rosterPositions: readonly string[],
  roster: readonly DraftSimulationPlayer[],
  overallPick: number,
) => {
  const fillsStarter = candidateFillsStarter(rosterPositions, roster, player).fillsStarter;
  const adpUrgency = player.adp === undefined ? 0 : Math.max(-15, overallPick - player.adp) * 0.35;
  const tierBonus = player.tier === undefined ? 0 : Math.max(0, 4 - player.tier) * 2;
  return player.projectedPoints + (fillsStarter ? 35 : 0) + adpUrgency + tierBonus;
};
function selectPlayer(input: {
  available: readonly DraftSimulationPlayer[];
  rosterPositions: readonly string[];
  roster: readonly DraftSimulationPlayer[];
  overallPick: number;
  rand: () => number;
  deterministic: boolean;
}) {
  const ranked = input.available
    .map((player) => ({
      player,
      utility: pickUtility(player, input.rosterPositions, input.roster, input.overallPick),
    }))
    .sort((left, right) => right.utility - left.utility)
    .slice(0, 24);
  if (!ranked.length) return undefined;
  if (input.deterministic) return ranked[0]?.player;
  const maxUtility = ranked[0]?.utility ?? 0;
  const weights = ranked.map((item) => Math.exp((item.utility - maxUtility) / 18));
  let threshold = input.rand() * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [index, item] of ranked.entries()) {
    threshold -= weights[index] ?? 0;
    if (threshold <= 0) return item.player;
  }
  return ranked.at(-1)?.player;
}

/** Runs candidate-specific, roster-aware draft copies and returns aggregate outcomes only. */
export function runRosterSimulation(input: {
  candidates: readonly DraftSimulationPlayer[];
  playerPool: readonly DraftSimulationPlayer[];
  teams: readonly DraftSimulationTeam[];
  userTeamId: string;
  rosterPositions: readonly string[];
  futurePickTeamIds: readonly string[];
  currentOverallPick: number;
  trials: number;
  seed: string;
}): readonly RosterSimulationSummary[] {
  const trials = Math.max(1, input.trials);
  return input.candidates.map((candidate, candidateIndex) => {
    let availableAtNextPick = 0;
    let completedStarters = 0;
    const starterValues: number[] = [];
    for (let trial = 0; trial < trials; trial++) {
      const rand = random(seedNumber(`${input.seed}:${candidate.id}:${candidateIndex}:${trial}`));
      let available = [...input.playerPool];
      const rosters = new Map(
        input.teams.map((team) => [team.id, [...team.roster] as DraftSimulationPlayer[]]),
      );
      let candidateResolved = false;
      for (const [offset, teamId] of input.futurePickTeamIds.entries()) {
        const roster = rosters.get(teamId);
        if (!roster || !available.length) continue;
        const overallPick = input.currentOverallPick + offset;
        if (teamId === input.userTeamId && !candidateResolved) {
          candidateResolved = true;
          const candidateIsAvailable = available.some((player) => player.id === candidate.id);
          if (candidateIsAvailable) availableAtNextPick += 1;
          const selected = candidateIsAvailable
            ? candidate
            : selectPlayer({
                available,
                rosterPositions: input.rosterPositions,
                roster,
                overallPick,
                rand,
                deterministic: true,
              });
          if (selected) {
            roster.push(selected);
            available = removePlayer(available, selected.id);
          }
          continue;
        }
        const selected = selectPlayer({
          available,
          rosterPositions: input.rosterPositions,
          roster,
          overallPick,
          rand,
          deterministic: teamId === input.userTeamId,
        });
        if (selected) {
          roster.push(selected);
          available = removePlayer(available, selected.id);
        }
      }
      const finalValue = starterValue(input.rosterPositions, rosters.get(input.userTeamId) ?? []);
      starterValues.push(finalValue.value);
      if (finalValue.complete) completedStarters += 1;
    }
    const sortedValues = [...starterValues].sort((left, right) => left - right);
    const downsideIndex = Math.max(0, Math.floor((sortedValues.length - 1) * 0.2));
    return {
      playerId: candidate.id,
      availableAtNextPickProbability: Number((availableAtNextPick / trials).toFixed(3)),
      expectedStarterValue: Number(
        (starterValues.reduce((sum, value) => sum + value, 0) / trials).toFixed(2),
      ),
      downsideStarterValue: Number((sortedValues[downsideIndex] ?? 0).toFixed(2)),
      starterCompletionProbability: Number((completedStarters / trials).toFixed(3)),
    };
  });
}
