import { getJson } from "./http";
import {
  ProviderError,
  type ProjectionImport,
  type ProjectionProvider,
  type ProjectionRequest,
} from "./ports";

const NFL_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;

type FantasyProsPlayer = {
  fpid?: number;
  name?: string;
  position_id?: string;
  team_id?: string;
  stats?: Record<string, number>;
};

const numeric = (value: number | undefined) => value ?? 0;

function normalizeStats(stats: Record<string, number> = {}) {
  return {
    fantasyPoints: numeric(stats.points_ppr || stats.points),
    pass_yd: numeric(stats.pass_yds),
    pass_td: numeric(stats.pass_tds),
    pass_int: numeric(stats.pass_ints),
    rush_yd: numeric(stats.rush_yds),
    rush_td: numeric(stats.rush_tds),
    rec: numeric(stats.rec_rec),
    rec_yd: numeric(stats.rec_yds),
    rec_td: numeric(stats.rec_tds),
    fumble_lost: numeric(stats.fumbles),
    two_pt: numeric(stats["2pt_tds"]),
  };
}

/** Fetches season-long FantasyPros NFL projections and normalizes them to DraftSense scoring keys. */
export class FantasyProsProjectionProvider implements ProjectionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.fantasypros.com/public/v2/json",
  ) {}

  async getProjections(input: ProjectionRequest): Promise<ProjectionImport> {
    const responses = await Promise.all(
      NFL_POSITIONS.map(async (position) => {
        const url = new URL(`${this.baseUrl}/nfl/${input.season}/projections`);
        url.searchParams.set("position", position);
        return (await getJson(url.toString(), {
          headers: { "x-api-key": this.apiKey },
        })) as { week?: string | number; players?: FantasyProsPlayer[] };
      }),
    );
    if (responses.some((response) => !Array.isArray(response.players)))
      throw new ProviderError(
        "INVALID_RESPONSE",
        "FantasyPros response did not include player projections.",
      );

    return {
      source: "fantasypros",
      retrievedAt: new Date(),
      sourceVersion: `${input.season}-week-${responses[0]?.week ?? 0}`,
      players: responses.flatMap((response) =>
        (response.players ?? []).flatMap((player) =>
          player.fpid && player.name && player.position_id
            ? [
                {
                  externalPlayerId: String(player.fpid),
                  fullName: player.name,
                  team: player.team_id,
                  position: player.position_id,
                  stats: normalizeStats(player.stats),
                },
              ]
            : [],
        ),
      ),
    };
  }
}
