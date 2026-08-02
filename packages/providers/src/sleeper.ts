import { getJson } from "./http";
import { ProviderError, type DraftSnapshot, type ExternalLeague, type LeaguePlatformProvider, type LeagueSnapshot } from "./ports";
export class SleeperLeagueProvider implements LeaguePlatformProvider {
  constructor(private readonly baseUrl = "https://api.sleeper.app/v1") {}
  async findLeagues({ username, season }: { username: string; season: number }): Promise<readonly ExternalLeague[]> {
    const user = await getJson(`${this.baseUrl}/user/${encodeURIComponent(username)}`) as { user_id?: string };
    if (!user.user_id) throw new ProviderError("INVALID_RESPONSE", "Sleeper user response did not include an ID.");
    const data = await getJson(`${this.baseUrl}/user/${user.user_id}/leagues/nfl/${season}`) as Array<{ league_id?: string; name?: string; draft_id?: string }>;
    if (!Array.isArray(data)) throw new ProviderError("INVALID_RESPONSE", "Sleeper leagues response was not an array.");
    return data.flatMap((league) => league.league_id && league.name ? [{ provider: "sleeper" as const, externalLeagueId: league.league_id, name: league.name, season, draftId: league.draft_id }] : []);
  }
  async getLeagueSnapshot({ leagueId }: { leagueId: string }): Promise<LeagueSnapshot> {
    const data = await getJson(`${this.baseUrl}/league/${encodeURIComponent(leagueId)}`) as { league_id?: string; name?: string; season?: string; draft_id?: string; scoring_settings?: Record<string, number>; roster_positions?: string[] };
    if (!data.league_id || !data.name || !data.season) throw new ProviderError("INVALID_RESPONSE", "Sleeper league response was incomplete.");
    return { league: { provider: "sleeper", externalLeagueId: data.league_id, name: data.name, season: Number(data.season), draftId: data.draft_id }, scoringRules: data.scoring_settings ?? {}, rosterPositions: data.roster_positions ?? [] };
  }
  async getDraftSnapshot({ draftId }: { draftId: string }): Promise<DraftSnapshot> {
    const data = await getJson(`${this.baseUrl}/draft/${encodeURIComponent(draftId)}/picks`) as Array<{ pick_no?: number; player_id?: string; roster_id?: number }>;
    if (!Array.isArray(data)) throw new ProviderError("INVALID_RESPONSE", "Sleeper picks response was not an array.");
    return { draftId, retrievedAt: new Date(), picks: data.flatMap((pick) => pick.pick_no && pick.player_id && pick.roster_id ? [{ overallPick: pick.pick_no, externalPlayerId: pick.player_id, rosterId: String(pick.roster_id) }] : []) };
  }
}
