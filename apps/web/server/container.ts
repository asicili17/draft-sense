import { FantasyFootballCalculatorAdpProvider, MySportsFeedsProjectionProvider, SleeperLeagueProvider } from "@draft-sense/providers";
import { parseEnvironment } from "./env";
export function buildAppContainer() {
  const env = parseEnvironment();
  return { sleeper: new SleeperLeagueProvider(env.SLEEPER_API_BASE_URL), projections: env.MYSPORTSFEEDS_API_KEY ? new MySportsFeedsProjectionProvider(env.MYSPORTSFEEDS_API_KEY, "https://api.mysportsfeeds.com/v2.1/pull/nfl") : undefined, adp: new FantasyFootballCalculatorAdpProvider(env.FANTASY_FOOTBALL_CALCULATOR_API_BASE_URL) };
}
