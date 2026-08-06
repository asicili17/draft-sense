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
  readonly draftOrder?: Readonly<Record<string, number>> | undefined;
  readonly teams: readonly DraftTeamSnapshot[];
  readonly picks: readonly {
    overallPick: number;
    externalPlayerId: string;
    rosterId: string;
  }[];
  readonly retrievedAt: Date;
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
