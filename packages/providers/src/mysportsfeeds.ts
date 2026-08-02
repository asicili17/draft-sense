import { getJson } from "./http";
import { ProviderError, type ProjectionImport, type ProjectionProvider, type ProjectionRequest } from "./ports";
export class MySportsFeedsProjectionProvider implements ProjectionProvider {
  constructor(private readonly apiKey: string, private readonly baseUrl: string) {}
  async getProjections(input: ProjectionRequest): Promise<ProjectionImport> {
    const data = await getJson(`${this.baseUrl}/seasonal_player_projections.json?season=${input.season}`, { headers: { Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}` } }) as { playerprojections?: Array<{ player?: { id?: string; firstName?: string; lastName?: string; teamAbbreviation?: string; primaryPosition?: string }; stats?: Record<string, number> }> };
    if (!Array.isArray(data.playerprojections)) throw new ProviderError("INVALID_RESPONSE", "Projection response did not include player projections.");
    return { source: "mysportsfeeds", retrievedAt: new Date(), players: data.playerprojections.flatMap(({ player, stats }) => player?.id && player.firstName && player.lastName ? [{ externalPlayerId: String(player.id), fullName: `${player.firstName} ${player.lastName}`, team: player.teamAbbreviation, position: player.primaryPosition, stats: stats ?? {} }] : []) };
  }
}
