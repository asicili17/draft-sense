import { getJson } from "./http";
import { ProviderError, type AdpImport, type AdpProvider, type AdpRequest } from "./ports";
export class FantasyFootballCalculatorAdpProvider implements AdpProvider {
  constructor(private readonly baseUrl = "https://fantasyfootballcalculator.com/api/v1") {}
  async getAdp(input: AdpRequest): Promise<AdpImport> {
    const url = new URL(
      `${this.baseUrl}/adp/${input.scoring === "half-ppr" ? "half-ppr" : input.scoring}`,
    );
    url.searchParams.set("teams", String(input.teams));
    url.searchParams.set("year", String(input.season));
    const data = (await getJson(url.toString())) as {
      players?: Array<{
        name?: string;
        team?: string;
        position?: string;
        adp?: number;
      }>;
    };
    if (!Array.isArray(data.players))
      throw new ProviderError("INVALID_RESPONSE", "ADP response did not include players.");
    return {
      source: "fantasy-football-calculator",
      retrievedAt: new Date(),
      players: data.players.flatMap((player) =>
        player.name && Number.isFinite(player.adp)
          ? [
              {
                fullName: player.name,
                team: player.team,
                position: player.position,
                adp: Number(player.adp),
              },
            ]
          : [],
      ),
    };
  }
}
