import {
  NFL_STARTER_POSITIONS,
  candidateFillsStarter,
  evaluateStarterRoster,
  starterDemandByPosition,
  type NflStarterPosition,
} from "@draft-sense/roster-construction";

// Bump whenever the candidate pool or scoring semantics change so existing
// immutable snapshots are never returned as though they used new logic.
export const ALGORITHM_VERSION = "2.1.0";

export interface RecommendationPlayer {
  id: string;
  name: string;
  position: string;
  projectedPoints: number;
  adp?: number | undefined;
  tier?: number | undefined;
  rankStdDev?: number | undefined;
  risk?: number | undefined;
}

export interface RecommendationInput {
  players: readonly RecommendationPlayer[];
  draftedPlayerIds: readonly string[];
  rosterPositions: readonly string[];
  roster: readonly string[];
  teamCount?: number | undefined;
  currentOverallPick?: number | undefined;
  nextOverallPick?: number | undefined;
  totalRounds?: number | undefined;
}

export interface Recommendation {
  playerId: string;
  name: string;
  score: number;
  confidence: number;
  reason: string;
  factors: {
    vorp: number;
    scarcity: number;
    rosterFit: number;
    lineupGain: number;
    adpValue: number;
    availability: number;
    tierDrop: number;
    waitCost: number;
    risk: number;
  };
  normalizedFactors: {
    vorp: number;
    scarcity: number;
    rosterFit: number;
    lineupGain: number;
    adpValue: number;
    availability: number;
    tierDrop: number;
    waitCost: number;
    risk: number;
  };
}

const positions = new Set<string>(NFL_STARTER_POSITIONS);
const specialPositions = new Set(["K", "DST"]);

const isStarterPosition = (position: string): position is NflStarterPosition =>
  positions.has(position);

const isEligibleRecommendationPlayer = (
  player: RecommendationPlayer,
): player is RecommendationPlayer & { position: NflStarterPosition } =>
  isStarterPosition(player.position);

const formatSlot = (label: string) => label.replace(/_/g, " ");

function reasonFor(input: {
  fillsStarter: boolean;
  player: RecommendationPlayer;
  openSlots: readonly { label: string; eligiblePositions: readonly string[] }[];
  unsupportedSlots: readonly string[];
}) {
  if (input.fillsStarter) {
    const matchingSlot = input.openSlots.find((slot) =>
      slot.eligiblePositions.includes(input.player.position),
    );
    return matchingSlot
      ? `Fills your open ${formatSlot(matchingSlot.label)} starter slot.`
      : "Improves your ability to complete a legal starting lineup.";
  }
  if (input.unsupportedSlots.length)
    return `Adds depth; unsupported roster slot: ${input.unsupportedSlots[0]}.`;
  return "Adds depth after current starter needs are accounted for.";
}

const survivalProbability = (player: RecommendationPlayer, nextOverallPick: number) => {
  if (player.adp === undefined) return undefined;
  const spread = Math.max(8, player.rankStdDev ?? 12);
  return 1 / (1 + Math.exp((nextOverallPick - player.adp) / spread));
};

function tierDropFor(
  player: RecommendationPlayer & { position: NflStarterPosition },
  availableByPosition: ReadonlyMap<NflStarterPosition, readonly RecommendationPlayer[]>,
) {
  const playerTier = player.tier;
  if (playerTier === undefined) return 0;
  const nextTierPlayer = (availableByPosition.get(player.position) ?? []).find(
    (candidate) => candidate.tier !== undefined && candidate.tier > playerTier,
  );
  return nextTierPlayer ? Math.max(0, player.projectedPoints - nextTierPlayer.projectedPoints) : 0;
}

export function recommend(input: RecommendationInput): readonly Recommendation[] {
  const available = input.players
    .filter((player) => !input.draftedPlayerIds.includes(player.id))
    .filter(isEligibleRecommendationPlayer);
  const roster = input.roster.map((position, index) => ({
    id: `roster-${index}`,
    positions: [position],
  }));
  const currentRoster = evaluateStarterRoster(input.rosterPositions, roster);
  const teamCount = Math.max(2, input.teamCount ?? 12);
  const totalRounds = Math.max(1, input.totalRounds ?? input.rosterPositions.length);
  const currentOverallPick = Math.max(
    1,
    input.currentOverallPick ?? input.draftedPlayerIds.length + 1,
  );
  const nextOverallPick = Math.max(currentOverallPick, input.nextOverallPick ?? currentOverallPick);
  const draftProgress = currentOverallPick / Math.max(1, teamCount * totalRounds);
  const demand = starterDemandByPosition(input.rosterPositions, teamCount);
  const availableByPosition = new Map<NflStarterPosition, RecommendationPlayer[]>();
  for (const position of NFL_STARTER_POSITIONS)
    availableByPosition.set(
      position,
      available
        .filter((player) => player.position === position)
        .sort((left, right) => right.projectedPoints - left.projectedPoints),
    );
  const baselines = new Map<NflStarterPosition, number>();
  for (const position of NFL_STARTER_POSITIONS) {
    const values = availableByPosition.get(position) ?? [];
    const replacementIndex = Math.max(0, Math.ceil(demand[position]) - 1);
    baselines.set(position, values[replacementIndex]?.projectedPoints ?? 0);
  }

  const hasNonSpecialStarterNeed = currentRoster.openSlots.some((slot) =>
    slot.eligiblePositions.some((position) => !specialPositions.has(position)),
  );
  const ranked = available
    .flatMap((player) => {
      const candidate = candidateFillsStarter(input.rosterPositions, roster, {
        id: player.id,
        positions: [player.position],
      });
      const fillsStarter = candidate.fillsStarter;
      const isSpecial = specialPositions.has(player.position);
      // Kickers and defenses wait until the manager can fill every skill-position
      // starter and the draft has entered its final quarter.
      if (isSpecial && (hasNonSpecialStarterNeed || draftProgress < 0.75)) return [];
      // Do not spend an early pick on bench depth while any legal starter remains
      // empty. SUPER_FLEX QB2 is permitted because it fills a starter slot.
      if (!fillsStarter && currentRoster.openSlots.length > 0) return [];

      const vorp = player.projectedPoints - (baselines.get(player.position) ?? 0);
      const positionAvailable = availableByPosition.get(player.position)?.length ?? 0;
      const scarcity = Math.min(1, demand[player.position] / Math.max(positionAvailable, 1));
      const rosterFit = fillsStarter ? 1 : 0.15;
      const lineupGain = fillsStarter ? Math.max(0, vorp) : 0;
      const availability = survivalProbability(player, nextOverallPick);
      const urgency = availability === undefined ? 0 : 1 - availability;
      const adpValue =
        player.adp === undefined
          ? 0
          : Math.min(1, Math.max(0, currentOverallPick - player.adp) / 20);
      const tierDrop = tierDropFor(player, availableByPosition);
      const waitCost = urgency * (Math.max(0, vorp) + lineupGain + tierDrop);
      const risk = player.risk ?? 0;
      const rosterReason = reasonFor({
        fillsStarter,
        player,
        openSlots: currentRoster.openSlots,
        unsupportedSlots: currentRoster.unsupportedSlots,
      });
      const reason =
        availability !== undefined && urgency >= 0.65
          ? `Take now: only ${Math.round(availability * 100)}% likely to reach pick ${nextOverallPick}. ${rosterReason}`
          : adpValue >= 0.5
            ? `Falling past ADP. ${rosterReason}`
            : rosterReason;
      return [
        {
          player,
          factors: {
            vorp,
            scarcity,
            rosterFit,
            lineupGain,
            adpValue,
            availability: availability ?? 0.5,
            tierDrop,
            waitCost,
            risk,
          },
          reason,
          score:
            vorp +
            scarcity * 12 +
            rosterFit * 28 +
            lineupGain * 0.15 +
            adpValue * 8 +
            tierDrop * urgency * 0.2 +
            waitCost * 0.35 -
            risk * 8,
        },
      ];
    })
    .sort((left, right) => right.score - left.score);
  const maxVorp = Math.max(...ranked.map((item) => Math.max(0, item.factors.vorp)), 1);
  const maxLineupGain = Math.max(...ranked.map((item) => item.factors.lineupGain), 1);
  const maxTierDrop = Math.max(...ranked.map((item) => item.factors.tierDrop), 1);
  const maxWaitCost = Math.max(...ranked.map((item) => item.factors.waitCost), 1);
  return ranked.map((item, index) => ({
    playerId: item.player.id,
    name: item.player.name,
    score: Number(item.score.toFixed(2)),
    reason: item.reason,
    confidence: Number(
      Math.max(
        0.25,
        Math.min(0.95, index === 0 ? (item.score - (ranked[1]?.score ?? 0)) / 20 + 0.55 : 0.45),
      ).toFixed(2),
    ),
    factors: item.factors,
    normalizedFactors: {
      vorp: Number((Math.max(0, item.factors.vorp) / maxVorp).toFixed(3)),
      scarcity: Number(item.factors.scarcity.toFixed(3)),
      rosterFit: Number(item.factors.rosterFit.toFixed(3)),
      lineupGain: Number((item.factors.lineupGain / maxLineupGain).toFixed(3)),
      adpValue: Number(item.factors.adpValue.toFixed(3)),
      availability: Number(item.factors.availability.toFixed(3)),
      tierDrop: Number((item.factors.tierDrop / maxTierDrop).toFixed(3)),
      waitCost: Number((item.factors.waitCost / maxWaitCost).toFixed(3)),
      risk: Number(item.factors.risk.toFixed(3)),
    },
  }));
}
