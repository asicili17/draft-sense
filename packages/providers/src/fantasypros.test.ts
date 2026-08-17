import { afterEach, describe, expect, it, vi } from "vitest";
import { FantasyProsMarketRankingProvider, FantasyProsProjectionProvider } from "./fantasypros";

describe("FantasyProsProjectionProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches each NFL position and normalizes FantasyPros stats", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            week: 0,
            players: [
              {
                fpid: 17240,
                name: "Saquon Barkley",
                position_id: "RB",
                team_id: "PHI",
                stats: {
                  points_ppr: 321.47,
                  rush_yds: 1683.6,
                  rush_tds: 11.08,
                  rec_rec: 43.23,
                  rec_yds: 331.1,
                  rec_tds: 2.19,
                  fumbles: 1.41,
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    const result = await new FantasyProsProjectionProvider("test-key").getProjections({
      season: 2025,
    });

    expect(fetch).toHaveBeenCalledTimes(6);
    expect(result).toMatchObject({ source: "fantasypros", sourceVersion: "2025-week-0" });
    expect(result.players[0]).toMatchObject({
      externalPlayerId: "17240",
      stats: {
        fantasyPoints: 321.47,
        rush_yd: 1683.6,
        rush_td: 11.08,
        rec: 43.23,
        rec_yd: 331.1,
        rec_td: 2.19,
        fumble_lost: 1.41,
      },
    });
  });
});

describe("FantasyProsMarketRankingProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("imports scoring-specific consensus market fields", async () => {
    const requestedUrls: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          players: [
            {
              player_name: "Saquon Barkley",
              player_team_id: "PHI",
              position_id: "RB",
              adp_avg: "4.2",
              rank_ecr: "3",
              tier: "1",
              rank_std_dev: "1.7",
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetch);

    const result = await new FantasyProsMarketRankingProvider("test-key").getConsensusRankings({
      season: 2026,
      scoring: "half-ppr",
    });

    expect(fetch).toHaveBeenCalledTimes(6);
    expect(requestedUrls[0]).toContain("scoring=HALF");
    expect(result).toMatchObject({ source: "fantasypros", season: 2026, scoring: "half-ppr" });
    expect(result.players[0]).toMatchObject({
      fullName: "Saquon Barkley",
      adp: 4.2,
      ecr: 3,
      tier: 1,
      rankStdDev: 1.7,
    });
  });
});
