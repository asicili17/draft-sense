import { recommend, type RecommendationInput } from "./index";

/** A stored, point-in-time draft decision used for offline policy comparison. */
export interface RecommendationEvaluationCase {
  id: string;
  input: RecommendationInput;
  /** The player actually drafted at this historical pick, if known. */
  observedPlayerId?: string | undefined;
}

export interface RecommendationEvaluationResult {
  cases: number;
  observedChoices: number;
  topChoiceAgreement: number;
  meanObservedRank: number | null;
  results: readonly {
    id: string;
    recommendedPlayerId?: string | undefined;
    observedPlayerId?: string | undefined;
    observedRank?: number | undefined;
  }[];
}

/**
 * Evaluates a policy only from data available at each saved draft snapshot.
 * It intentionally does not use season-end results: those evaluate projections,
 * not whether the draft decision was sound at the time.
 */
export function evaluateRecommendationCases(
  cases: readonly RecommendationEvaluationCase[],
): RecommendationEvaluationResult {
  const results = cases.map((item) => {
    const ranking = recommend(item.input);
    const observedRank = item.observedPlayerId
      ? ranking.findIndex((candidate) => candidate.playerId === item.observedPlayerId) + 1
      : undefined;
    return {
      id: item.id,
      recommendedPlayerId: ranking[0]?.playerId,
      observedPlayerId: item.observedPlayerId,
      observedRank: observedRank && observedRank > 0 ? observedRank : undefined,
    };
  });
  const withObserved = results.filter((result) => result.observedPlayerId);
  const observedRanks = withObserved
    .map((result) => result.observedRank)
    .filter((rank): rank is number => rank !== undefined);
  return {
    cases: cases.length,
    observedChoices: withObserved.length,
    topChoiceAgreement:
      withObserved.length === 0
        ? 0
        : Number(
            (
              withObserved.filter(
                (result) => result.recommendedPlayerId === result.observedPlayerId,
              ).length / withObserved.length
            ).toFixed(3),
          ),
    meanObservedRank:
      observedRanks.length === 0
        ? null
        : Number(
            (observedRanks.reduce((total, rank) => total + rank, 0) / observedRanks.length).toFixed(2),
          ),
    results,
  };
}
