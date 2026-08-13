import { getJson } from "./http";
import {
  ProviderError,
  type DraftSnapshot,
  type ExternalLeague,
  type LeaguePlatformProvider,
  type LeagueSnapshot,
} from "./ports";
export class SleeperLeagueProvider implements LeaguePlatformProvider {
  constructor(private readonly baseUrl = "https://api.sleeper.app/v1") {}
  async getUser({ username }: { username: string }) {
    const user = (await getJson(`${this.baseUrl}/user/${encodeURIComponent(username)}`)) as {
      user_id?: string;
      username?: string;
      display_name?: string;
      avatar?: string;
    };
    if (!user.user_id)
      throw new ProviderError("INVALID_RESPONSE", "Sleeper user response did not include an ID.");
    return {
      externalUserId: user.user_id,
      username: user.username ?? username,
      displayName: user.display_name,
      avatar: user.avatar,
    };
  }
  async findLeagues({
    username,
    season,
  }: {
    username: string;
    season: number;
  }): Promise<readonly ExternalLeague[]> {
    const user = await this.getUser({ username });
    const data = (await getJson(
      `${this.baseUrl}/user/${user.externalUserId}/leagues/nfl/${season}`,
    )) as Array<{ league_id?: string; name?: string; draft_id?: string }>;
    if (!Array.isArray(data))
      throw new ProviderError("INVALID_RESPONSE", "Sleeper leagues response was not an array.");
    return data.flatMap((league) =>
      league.league_id && league.name
        ? [
            {
              provider: "sleeper" as const,
              externalLeagueId: league.league_id,
              name: league.name,
              season,
              draftId: league.draft_id,
            },
          ]
        : [],
    );
  }
  async getLeagueSnapshot({ leagueId }: { leagueId: string }): Promise<LeagueSnapshot> {
    const data = (await getJson(`${this.baseUrl}/league/${encodeURIComponent(leagueId)}`)) as {
      league_id?: string;
      name?: string;
      season?: string;
      draft_id?: string;
      scoring_settings?: Record<string, number>;
      roster_positions?: string[];
    };
    if (!data.league_id || !data.name || !data.season)
      throw new ProviderError("INVALID_RESPONSE", "Sleeper league response was incomplete.");
    return {
      league: {
        provider: "sleeper",
        externalLeagueId: data.league_id,
        name: data.name,
        season: Number(data.season),
        draftId: data.draft_id,
      },
      scoringRules: data.scoring_settings ?? {},
      rosterPositions: data.roster_positions ?? [],
    };
  }
  async getDraftSnapshot({
    draftId,
    leagueId,
  }: {
    draftId: string;
    leagueId?: string;
  }): Promise<DraftSnapshot> {
    const [draft, picks, leagueUsers] = await Promise.all([
      getJson(`${this.baseUrl}/draft/${encodeURIComponent(draftId)}`) as Promise<{
        status?: string;
        draft_order?: Record<string, number>;
        slot_to_roster_id?: Record<string, number>;
      }>,
      getJson(`${this.baseUrl}/draft/${encodeURIComponent(draftId)}/picks`) as Promise<
        Array<{
          pick_no?: number;
          player_id?: string;
          roster_id?: number;
          metadata?: { first_name?: string; last_name?: string; team?: string; position?: string };
        }>
      >,
      leagueId
        ? (getJson(`${this.baseUrl}/league/${encodeURIComponent(leagueId)}/users`) as Promise<
            Array<{ user_id?: string; display_name?: string; metadata?: { team_name?: string } }>
          >)
        : Promise.resolve([]),
    ]);
    if (!Array.isArray(picks))
      throw new ProviderError("INVALID_RESPONSE", "Sleeper picks response was not an array.");
    const teamNamesBySlot = new Map(
      leagueUsers.flatMap((user) => {
        const slot = user.user_id ? draft.draft_order?.[user.user_id] : undefined;
        const name = user.metadata?.team_name || user.display_name;
        return slot && name ? [[slot, name] as const] : [];
      }),
    );
    const teams = Object.entries(draft.slot_to_roster_id ?? {}).flatMap(([slot, rosterId]) =>
      Number.isInteger(Number(slot))
        ? [
            {
              slot: Number(slot),
              name: teamNamesBySlot.get(Number(slot)) ?? `Team ${slot}`,
              externalRosterId: String(rosterId),
            },
          ]
        : [],
    );
    return {
      draftId,
      status: draft.status,
      draftOrder: draft.draft_order,
      teams,
      retrievedAt: new Date(),
      picks: picks.flatMap((pick) =>
        pick.pick_no && pick.player_id && pick.roster_id
          ? (() => {
              const fullName = [pick.metadata?.first_name, pick.metadata?.last_name]
                .filter((part): part is string => Boolean(part))
                .join(" ");
              return [
                {
                  overallPick: pick.pick_no,
                  externalPlayerId: pick.player_id,
                  rosterId: String(pick.roster_id),
                  ...(fullName ? { fullName } : {}),
                  ...(pick.metadata?.team ? { team: pick.metadata.team } : {}),
                  ...(pick.metadata?.position
                    ? { position: pick.metadata.position === "DEF" ? "DST" : pick.metadata.position }
                    : {}),
                },
              ];
            })()
          : [],
      ),
    };
  }
}
