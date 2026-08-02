export const ALGORITHM_VERSION = "1.0.0";
export interface RecommendationPlayer {
  id: string;
  name: string;
  position: string;
  projectedPoints: number;
  adp?: number | undefined;
  risk?: number | undefined;
}
export interface RecommendationInput {
  players: readonly RecommendationPlayer[];
  draftedPlayerIds: readonly string[];
  rosterPositions: readonly string[];
  roster: readonly string[];
}
export interface Recommendation {
  playerId: string;
  name: string;
  score: number;
  confidence: number;
  factors: {
    vorp: number;
    scarcity: number;
    rosterFit: number;
    adpValue: number;
    risk: number;
  };
}
const starters = (positions: readonly string[], position: string) =>
  positions.filter((value) => value === position).length;
export function recommend(input: RecommendationInput): readonly Recommendation[] {
  const available = input.players.filter((player) => !input.draftedPlayerIds.includes(player.id));
  const baselines = new Map<string, number>();
  for (const position of ["QB", "RB", "WR", "TE", "K", "DST"]) {
    const values = available
      .filter((p) => p.position === position)
      .map((p) => p.projectedPoints)
      .sort((a, b) => b - a);
    baselines.set(
      position,
      values[Math.max(0, starters(input.rosterPositions, position) * 2 - 1)] ?? 0,
    );
  }
  const ranked = available
    .map((player) => {
      const vorp = player.projectedPoints - (baselines.get(player.position) ?? 0);
      const positionAvailable = available.filter((p) => p.position === player.position).length;
      const scarcity = Math.max(0, 20 - positionAvailable) / 20;
      const need =
        starters(input.rosterPositions, player.position) -
        input.roster.filter((pos) => pos === player.position).length;
      const rosterFit = need > 0 ? 1 : 0.2;
      const adpValue = player.adp ? Math.max(0, 250 - player.adp) / 250 : 0;
      const risk = player.risk ?? 0;
      return {
        player,
        factors: { vorp, scarcity, rosterFit, adpValue, risk },
        score: vorp + scarcity * 12 + rosterFit * 8 + adpValue * 4 - risk * 8,
      };
    })
    .sort((a, b) => b.score - a.score);
  return ranked.map((item, index) => ({
    playerId: item.player.id,
    name: item.player.name,
    score: Number(item.score.toFixed(2)),
    confidence: Number(
      Math.max(
        0.25,
        Math.min(0.95, index === 0 ? (item.score - (ranked[1]?.score ?? 0)) / 20 + 0.55 : 0.45),
      ).toFixed(2),
    ),
    factors: item.factors,
  }));
}
