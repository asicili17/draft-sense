export type ProviderName = "sleeper" | "fantasypros" | "fantasy-football-calculator";
export type ProviderErrorCode =
  "UNAVAILABLE" | "RATE_LIMITED" | "INVALID_RESPONSE" | "AUTHENTICATION_FAILED";
export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
export interface ExternalLeague {
  readonly provider: ProviderName;
  readonly externalLeagueId: string;
  readonly name: string;
  readonly season: number;
  readonly draftId?: string | undefined;
}
export interface LeagueSnapshot {
  readonly league: ExternalLeague;
  readonly scoringRules: Readonly<Record<string, number>>;
  readonly rosterPositions: readonly string[];
}
export interface DraftTeamSnapshot {
  readonly slot: number;
  readonly name: string;
  readonly externalRosterId?: string;
}
export interface DraftSnapshot {
  readonly draftId: string;
  readonly status?: string | undefined;
  readonly type?: "snake" | "auction" | string | undefined;
  readonly settings?:
    | {
        readonly teams?: number | undefined;
        readonly rounds?: number | undefined;
        readonly pickTimer?: number | undefined;
      }
    | undefined;
  readonly draftOrder?: Readonly<Record<string, number>> | undefined;
  readonly slotToRosterId?: Readonly<Record<string, string>> | undefined;
  readonly pickSchedule?: readonly DraftPickScheduleEntry[] | undefined;
  readonly tradedPicks?: readonly TradedDraftPick[] | undefined;
  readonly teams: readonly DraftTeamSnapshot[];
  readonly picks: readonly {
    overallPick: number;
    externalPlayerId: string;
    rosterId: string;
    fullName?: string;
    team?: string;
    position?: string;
  }[];
  readonly retrievedAt: Date;
}
export interface DraftPickScheduleEntry {
  readonly overallPick: number;
  readonly round: number;
  readonly draftSlot: number;
  readonly rosterId: string;
}
export interface TradedDraftPick {
  readonly round: number;
  readonly originalRosterId: string;
  readonly currentRosterId: string;
}
export interface ProjectionRequest {
  readonly season: number;
}
export interface ProjectedPlayer {
  readonly externalPlayerId: string;
  readonly fullName: string;
  readonly team?: string | undefined;
  readonly position?: string | undefined;
  readonly stats: Readonly<Record<string, number>>;
}
export interface ProjectionImport {
  readonly source: ProviderName;
  readonly retrievedAt: Date;
  readonly sourceVersion?: string;
  readonly players: readonly ProjectedPlayer[];
}
export interface AdpRequest {
  readonly season: number;
  readonly scoring: "standard" | "half-ppr" | "ppr";
  readonly teams: number;
}
export interface AdpPlayer {
  readonly fullName: string;
  readonly team?: string | undefined;
  readonly position?: string | undefined;
  readonly adp: number;
}
export interface AdpImport {
  readonly source: ProviderName;
  readonly retrievedAt: Date;
  readonly players: readonly AdpPlayer[];
}
export type MarketScoring = "standard" | "half-ppr" | "ppr";
export interface MarketRankingRequest {
  readonly season: number;
  readonly scoring: MarketScoring;
}
export interface MarketPlayer {
  readonly fullName: string;
  readonly team?: string | undefined;
  readonly position?: string | undefined;
  readonly adp?: number | undefined;
  readonly ecr?: number | undefined;
  readonly tier?: number | undefined;
  readonly rankStdDev?: number | undefined;
}
export interface MarketRankingImport {
  readonly source: ProviderName;
  readonly retrievedAt: Date;
  readonly season: number;
  readonly scoring: MarketScoring;
  readonly players: readonly MarketPlayer[];
}
export interface LeaguePlatformProvider {
  findLeagues(input: { username: string; season: number }): Promise<readonly ExternalLeague[]>;
  getLeagueSnapshot(input: { leagueId: string }): Promise<LeagueSnapshot>;
  getDraftSnapshot(input: { draftId: string; leagueId?: string }): Promise<DraftSnapshot>;
}
export interface ProjectionProvider {
  getProjections(input: ProjectionRequest): Promise<ProjectionImport>;
}
export interface AdpProvider {
  getAdp(input: AdpRequest): Promise<AdpImport>;
}
export interface MarketRankingProvider {
  getConsensusRankings(input: MarketRankingRequest): Promise<MarketRankingImport>;
}
