/**
 * The production baseline is deliberately explicit. Calibration can compare a
 * challenger against this version on held-out draft snapshots before it becomes
 * the default recommendation policy.
 */
export const RECOMMENDATION_CONFIG_VERSION = "redraft-depth-2026-09";

export interface RecommendationWeights {
  scarcity: number;
  rosterFit: number;
  lineupGain: number;
  coverage: number;
  upside: number;
  completionUrgency: number;
  redundancy: number;
  adpValue: number;
  tierDropUrgency: number;
  waitCost: number;
  risk: number;
  simulationValue: number;
  simulationDownside: number;
  starterCompletion: number;
}

export const BASELINE_RECOMMENDATION_WEIGHTS: Readonly<RecommendationWeights> = {
  scarcity: 12,
  rosterFit: 22,
  lineupGain: 0.15,
  coverage: 22,
  upside: 10,
  completionUrgency: 20,
  redundancy: 14,
  adpValue: 8,
  tierDropUrgency: 0.2,
  waitCost: 0.35,
  risk: 8,
  simulationValue: 24,
  simulationDownside: 10,
  starterCompletion: 6,
};
