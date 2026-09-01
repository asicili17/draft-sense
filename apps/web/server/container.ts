import {
  FantasyFootballCalculatorAdpProvider,
  FantasyProsMarketRankingProvider,
  FantasyProsProjectionProvider,
  SleeperLeagueProvider,
} from "@draft-sense/providers";
import { parseEnvironment } from "./env";
export function buildAppContainer() {
  const env = parseEnvironment();
  return {
    sleeper: new SleeperLeagueProvider(env.SLEEPER_API_BASE_URL),
    projections: env.FANTASYPROS_API_KEY
      ? new FantasyProsProjectionProvider(env.FANTASYPROS_API_KEY)
      : undefined,
    marketRankings: env.FANTASYPROS_API_KEY
      ? new FantasyProsMarketRankingProvider(env.FANTASYPROS_API_KEY)
      : undefined,
    adp: new FantasyFootballCalculatorAdpProvider(env.FANTASY_FOOTBALL_CALCULATOR_API_BASE_URL),
  };
}
