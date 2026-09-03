"use client";

import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { shouldRefetchForRealtimeEvent } from "../features/draft/realtime";
import { useDraftRealtime } from "../features/draft/realtime-client";
import type { DraftRealtimeEvent } from "@draft-sense/events";

type League = { externalLeagueId: string; name: string; draftId?: string };
type DraftTeam = { slot: number; name: string };
type ImportPreview = { league: League; teams: DraftTeam[]; selectedTeamSlot: number };
type Recommendation = {
  playerId: string;
  name: string;
  reason: string;
  score: number;
  confidence: number;
  factors: { vorp: number; scarcity: number; rosterFit: number; lineupGain: number };
};
type Session = {
  id: string;
  version: number;
  selectedTeamId: string | null;
  teams: { id: string; name: string; slot: number }[];
  picks: {
    overallPick: number;
    player: { fullName: string; team?: string | null; positions: string[] };
    team: { id: string; name: string };
  }[];
  settings?: { source?: { leagueId?: string; draftId?: string } };
};
type AvailablePlayer = {
  id: string;
  name: string;
  team?: string | null;
  positions: string[];
  projectedPoints: number;
  adp?: number | null;
};
type SavedDraftRoom = {
  sessionId: string;
  leagueName: string;
  status: string;
  selectedTeam: { id: string; name: string; slot: number };
};

export function DraftAssistant() {
  const [username, setUsername] = useState("");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueTeams, setLeagueTeams] = useState<Record<string, DraftTeam[]>>({});
  const [loadingLeagueId, setLoadingLeagueId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [message, setMessage] = useState("");
  const [explanation, setExplanation] = useState("");
  const [explainingPlayerId, setExplainingPlayerId] = useState<string | null>(null);
  const [source, setSource] = useState<{ leagueId: string; draftId: string } | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [savedRooms, setSavedRooms] = useState<SavedDraftRoom[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [railView, setRailView] = useState<"recommendations" | "players">("recommendations");
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerPosition, setPlayerPosition] = useState("ALL");
  const sessionVersionRef = useRef(0);
  const refreshInFlightRef = useRef(new Map<string, Promise<void>>());

  const refreshSession = useCallback(async (id: string) => {
    const sessionResponse = await fetch(`/api/v1/draft-sessions/${id}`, { cache: "no-store" });
    const sessionPayload = await sessionResponse.json();
    if (sessionResponse.ok) {
      setSession(sessionPayload.data);
      sessionVersionRef.current = sessionPayload.data.version;
      const importedSource = sessionPayload.data.settings?.source;
      if (importedSource?.leagueId && importedSource?.draftId) setSource(importedSource);
    }
  }, []);

  const refreshRecommendations = useCallback(async (id: string) => {
    const recommendationResponse = await fetch(`/api/v1/draft-sessions/${id}/recommendations`, {
      cache: "no-store",
    });
    const recommendationPayload = await recommendationResponse.json();
    if (recommendationResponse.ok) {
      setRecommendations(recommendationPayload.data.recommendations);
      setSnapshotId(recommendationPayload.data.snapshotId);
    }
  }, []);

  const refreshAvailablePlayers = useCallback(async (id: string) => {
    const response = await fetch(`/api/v1/draft-sessions/${id}/available-players`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) setAvailablePlayers(payload.data);
  }, []);

  const refresh = useCallback(
    async (id: string) => {
      const inFlight = refreshInFlightRef.current.get(id);
      if (inFlight) return inFlight;
      const request = Promise.all([refreshSession(id), refreshRecommendations(id)]).then(
        () => undefined,
      );
      refreshInFlightRef.current.set(id, request);
      try {
        await request;
      } finally {
        refreshInFlightRef.current.delete(id);
      }
    },
    [refreshRecommendations, refreshSession],
  );

  const activeSessionId = session?.id;
  const realtimeChannels = useMemo(
    () => (activeSessionId ? [`draft:${activeSessionId}`] : []),
    [activeSessionId],
  );
  const onRealtimeData = useCallback(
    ({ data }: { data: unknown }) => {
      const update = data as DraftRealtimeEvent;
      const sessionId = session?.id;
      if (
        !sessionId ||
        !shouldRefetchForRealtimeEvent(update, sessionId, sessionVersionRef.current)
      )
        return;
      void refresh(sessionId);
    },
    [refresh, session?.id],
  );

  const realtime = useDraftRealtime({
    channels: realtimeChannels,
    events: ["draft.updated", "recommendations.updated", "simulation.updated"],
    enabled: Boolean(session),
    onData: onRealtimeData,
  });

  const loadSavedRooms = useCallback(async () => {
    const response = await fetch("/api/v1/draft-sessions", { cache: "no-store" });
    if (!response.ok) return setSavedRooms([]);
    const payload = await response.json();
    setSavedRooms(payload.data);
  }, []);

  const findLeagues = useCallback(async () => {
    setMessage("Loading your Sleeper leagues…");
    const response = await fetch("/api/v1/integrations/sleeper/leagues", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    setLeagues(payload.data);
    setMessage(
      payload.data.length ? "Choose a league to inspect its draft order." : "No NFL leagues found.",
    );
  }, []);

  const connectSleeper = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return;
    setMessage("Connecting your Sleeper account…");
    const response = await fetch("/api/v1/integrations/sleeper/connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: normalizedUsername }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    setUsername(payload.data.username);
    await findLeagues();
  };

  useEffect(() => {
    void loadSavedRooms();
    void (async () => {
      const response = await fetch("/api/v1/integrations/sleeper/connection", {
        cache: "no-store",
      });
      if (response.status === 404) return;
      const payload = await response.json();
      if (!response.ok) return setMessage(payload.error.message);
      setUsername(payload.data.username);
      await findLeagues();
    })();
  }, [findLeagues, loadSavedRooms]);

  useEffect(() => {
    if (!session) return;
    // This is a recovery read and active-room heartbeat, not a direct Sleeper poll.
    // The server-side worker owns provider refreshes while this room remains active.
    const timer = window.setInterval(() => void refreshSession(session.id), 10_000);
    return () => window.clearInterval(timer);
  }, [refreshSession, session?.id]);

  useEffect(() => {
    if (!session) return;
    // Opening a room explicitly starts its server-side Sleeper refresh loop. This
    // must not depend on the last heartbeat, which may belong to an earlier visit.
    void fetch(`/api/v1/draft-sessions/${session.id}`, { method: "POST" }).then((response) => {
      if (!response.ok)
        setMessage("Could not start live Sleeper updates. Please try reopening the room.");
    });
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    void refreshAvailablePlayers(session.id);
  }, [refreshAvailablePlayers, session?.id, session?.version]);

  const boardRounds = useMemo(() => {
    if (!session) return [];
    const teamCount = session.teams.length;
    const currentRound = Math.ceil((session.picks.length + 1) / teamCount);
    return Array.from({ length: Math.max(8, currentRound + 3) }, (_, index) => index + 1);
  }, [session]);

  const filteredAvailablePlayers = useMemo(() => {
    const query = playerQuery.trim().toLocaleLowerCase();
    return availablePlayers
      .filter((player) => playerPosition === "ALL" || player.positions.includes(playerPosition))
      .filter(
        (player) =>
          !query ||
          player.name.toLocaleLowerCase().includes(query) ||
          player.team?.toLocaleLowerCase().includes(query),
      )
      .slice(0, 80);
  }, [availablePlayers, playerPosition, playerQuery]);

  const draftPickAt = useCallback(
    (round: number, teamIndex: number) => {
      if (!session) return undefined;
      const teamCount = session.teams.length;
      const overallPick =
        (round - 1) * teamCount + (round % 2 === 1 ? teamIndex + 1 : teamCount - teamIndex);
      return {
        overallPick,
        pick: session.picks.find((item) => item.overallPick === overallPick),
      };
    },
    [session],
  );

  const loadLeagueTeams = async (league: League) => {
    if (!league.draftId || leagueTeams[league.externalLeagueId]) return;
    setLoadingLeagueId(league.externalLeagueId);
    const response = await fetch("/api/v1/draft-sessions/imports/sleeper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leagueId: league.externalLeagueId,
        draftId: league.draftId,
        preview: true,
      }),
    });
    const payload = await response.json();
    setLoadingLeagueId(null);
    if (!response.ok) return setMessage(payload.error.message);
    setLeagueTeams((current) => ({ ...current, [league.externalLeagueId]: payload.data.teams }));
  };

  const openLeague = async (league: League) => {
    if (!league.draftId) return setMessage("Sleeper has not created a draft for this league yet.");
    setMessage("Loading draft room setup…");
    const response = await fetch("/api/v1/draft-sessions/imports/sleeper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leagueId: league.externalLeagueId,
        draftId: league.draftId,
        preview: true,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    const teams = payload.data.teams as DraftTeam[];
    const firstTeam = teams[0];
    if (!firstTeam) return setMessage("Sleeper did not return any draft teams for this league.");
    setLeagueTeams((current) => ({ ...current, [league.externalLeagueId]: teams }));
    setImportPreview({ league, teams, selectedTeamSlot: firstTeam.slot });
  };

  const confirmLeagueImport = async () => {
    if (!importPreview?.league.draftId) return;
    setMessage("Creating your draft room…");
    const response = await fetch("/api/v1/draft-sessions/imports/sleeper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leagueId: importPreview.league.externalLeagueId,
        draftId: importPreview.league.draftId,
        selectedTeamSlot: importPreview.selectedTeamSlot,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    setSession(payload.data);
    const importedSource = payload.data.settings?.source;
    if (importedSource?.leagueId && importedSource?.draftId) setSource(importedSource);
    setImportPreview(null);
    await refresh(payload.data.id);
    await loadSavedRooms();
    setMessage("Draft room is open and syncs with Sleeper every 10 seconds.");
  };

  const refreshFromSleeper = async () => {
    const selectedTeamSlot = session?.teams.find(
      (team) => team.id === session.selectedTeamId,
    )?.slot;
    if (!source || !selectedTeamSlot) return;
    const response = await fetch("/api/v1/draft-sessions/imports/sleeper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...source, selectedTeamSlot }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    await refresh(payload.data.id);
    setMessage("Imported the latest Sleeper snapshot.");
  };

  const selectTeam = async (selectedTeamId: string) => {
    if (!session) return;
    const response = await fetch(`/api/v1/draft-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedTeamId }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    await refresh(session.id);
  };

  const explain = async (playerId: string) => {
    if (!session || !snapshotId || explainingPlayerId) return;
    setExplainingPlayerId(playerId);
    try {
      const response = await fetch(
        `/api/v1/draft-sessions/${session.id}/recommendations/explanation`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snapshotId, playerId }),
        },
      );
      const payload = await response.json();
      if (!response.ok) return setMessage(payload.error.message);
      setExplanation(`${payload.data.summary} ${payload.data.uncertainty}`);
    } finally {
      setExplainingPlayerId(null);
    }
  };

  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="DraftSense home">
          DraftSense
        </Link>
        <div className="topbar-actions">
          <span className="status-dot" /> {username ? "Sleeper connected" : "Connect Sleeper"}{" "}
          <UserButton />
        </div>
      </header>
      <div className="workspace-grid">
        <aside className="league-panel" aria-label="Your leagues">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Workspace</p>
              <h1>Your leagues</h1>
            </div>
          </div>
          <form
            className="connect-form"
            onSubmit={(event) => {
              event.preventDefault();
              void connectSleeper();
            }}
          >
            <label htmlFor="sleeper-username">Sleeper username</label>
            <div>
              <input
                id="sleeper-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="your-sleeper-name"
              />
              <button type="submit" disabled={!username.trim()}>
                {leagues.length ? "Reconnect" : "Connect"}
              </button>
            </div>
          </form>
          <p className="message" aria-live="polite">
            {message}
          </p>
          {leagues.length > 0 && (
            <Accordion.Root className="league-list" type="multiple">
              {leagues.map((league) => {
                const teams = leagueTeams[league.externalLeagueId];
                const isLoading = loadingLeagueId === league.externalLeagueId;
                return (
                  <Accordion.Item
                    className="league-item"
                    value={league.externalLeagueId}
                    key={league.externalLeagueId}
                  >
                    <div className="league-row">
                      <Accordion.Trigger
                        className="league-trigger"
                        onClick={() => void loadLeagueTeams(league)}
                      >
                        <span className="chevron" aria-hidden="true">
                          ⌄
                        </span>
                        <span>
                          <strong>{league.name}</strong>
                          <small>{league.draftId ? "Draft available" : "No draft yet"}</small>
                        </span>
                      </Accordion.Trigger>
                      <button
                        className="open-room"
                        type="button"
                        onClick={() => void openLeague(league)}
                        disabled={!league.draftId}
                      >
                        Open room
                      </button>
                    </div>
                    <Accordion.Content className="league-content">
                      {!league.draftId ? (
                        <p>Sleeper has not published this league’s draft yet.</p>
                      ) : isLoading ? (
                        <p>Loading draft order…</p>
                      ) : teams ? (
                        <ol>
                          {teams.map((team) => (
                            <li key={team.slot}>
                              <span>{team.slot}</span>
                              {team.name}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p>Expand to load the draft order.</p>
                      )}
                    </Accordion.Content>
                  </Accordion.Item>
                );
              })}
            </Accordion.Root>
          )}
          {!leagues.length && !message && (
            <p className="empty-state">
              Enter your Sleeper username to bring your leagues into this workspace.
            </p>
          )}
          {savedRooms.length > 0 && (
            <section className="saved-rooms">
              <p className="eyebrow">Recent rooms</p>
              {savedRooms.map((room) => (
                <button
                  type="button"
                  key={room.sessionId}
                  onClick={() => void refresh(room.sessionId)}
                >
                  <span>{room.leagueName}</span>
                  <small>{room.selectedTeam.name}</small>
                </button>
              ))}
            </section>
          )}
        </aside>
        <section className="content-panel" aria-label="Draft room">
          {session ? (
            <div className="draft-room">
              <div className="room-header">
                <div>
                  <p className="eyebrow">Draft room</p>
                  <h2>{session.teams.length}-team live board</h2>
                  <small className="realtime-status">
                    {realtime.status === "connected"
                      ? "Sleeper sync connected"
                      : "Sleeper sync reconnecting"}
                    {" · "}draft data refreshes every 10 seconds
                  </small>
                </div>
                <div className="room-header-actions">
                  <label className="team-select">
                    My team
                    <select
                      value={session.selectedTeamId ?? ""}
                      onChange={(event) => void selectTeam(event.target.value)}
                    >
                      <option value="" disabled>
                        Select your team
                      </option>
                      {session.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} (slot {team.slot})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void refreshFromSleeper()}
                    disabled={!source}
                  >
                    Refresh now
                  </button>
                </div>
              </div>
              <div className="draft-workspace">
                <section className="draft-board" aria-label="Draft board">
                  <div className="board-heading">
                    <div>
                      <p className="eyebrow">Draft board</p>
                      <h3>Every team, every pick</h3>
                    </div>
                    <span>{session.picks.length} picks recorded</span>
                  </div>
                  <div className="board-scroll">
                    <div className="draft-grid" style={{ "--team-count": session.teams.length } as CSSProperties}>
                      <div className="round-corner">Round</div>
                      {session.teams.map((team) => (
                        <div
                          className={`team-column-heading ${team.id === session.selectedTeamId ? "is-my-team" : ""}`}
                          key={team.id}
                        >
                          <span>{team.slot.toString().padStart(2, "0")}</span>
                          <strong>{team.name}</strong>
                        </div>
                      ))}
                      {boardRounds.map((round) => (
                        <div className="draft-grid-row" key={round}>
                          <div className="round-label">R{round}</div>
                          {session.teams.map((team, teamIndex) => {
                            const scheduled = draftPickAt(round, teamIndex);
                            const pick = scheduled?.pick;
                            const isCurrent = scheduled?.overallPick === session.picks.length + 1;
                            const position = pick?.player.positions[0] ?? "";
                            return (
                              <article
                                className={`pick-card ${position ? `position-${position.toLowerCase()}` : ""} ${
                                  team.id === session.selectedTeamId ? "is-my-team" : ""
                                } ${isCurrent ? "is-current-pick" : ""}`}
                                key={`${round}-${team.id}`}
                              >
                                {pick ? (
                                  <>
                                    <div className="pick-card-topline">
                                      <span>{scheduled?.overallPick}</span>
                                      <b>{position}</b>
                                    </div>
                                    <strong>{pick.player.fullName}</strong>
                                    <small>{pick.player.team ?? "NFL"}</small>
                                  </>
                                ) : isCurrent ? (
                                  <>
                                    <span className="current-pick-label">On the clock</span>
                                    <strong>{team.id === session.selectedTeamId ? "Your pick" : team.name}</strong>
                                    <small>Waiting for Sleeper sync</small>
                                  </>
                                ) : (
                                  <span className="empty-pick">{scheduled?.overallPick}</span>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <aside className="draft-rail" aria-label="Draft assistant">
                  <div className="rail-tabs" role="tablist" aria-label="Draft assistant views">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={railView === "recommendations"}
                      className={railView === "recommendations" ? "is-active" : ""}
                      onClick={() => setRailView("recommendations")}
                    >
                      Recommendations
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={railView === "players"}
                      className={railView === "players" ? "is-active" : ""}
                      onClick={() => setRailView("players")}
                    >
                      All players <span>{availablePlayers.length}</span>
                    </button>
                  </div>
                  {railView === "recommendations" ? (
                    <div className="recommendations">
                      <div className="rail-heading">
                        <p className="eyebrow">Draft assistant</p>
                        <h3>Best available now</h3>
                      </div>
                      {recommendations.slice(0, 5).map((item, index) => (
                        <article className={index === 0 ? "is-best-pick" : ""} key={item.playerId}>
                          {index === 0 && <span className="best-pick-label">Top recommendation</span>}
                          <strong>{item.name}</strong>
                          <span>
                            Score {item.score} · {Math.round(item.confidence * 100)}% confidence
                          </span>
                          <small>{item.reason}</small>
                          <div>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => void explain(item.playerId)}
                              disabled={Boolean(explainingPlayerId)}
                            >
                              {explainingPlayerId === item.playerId ? "Loading…" : "Why this player?"}
                            </button>
                          </div>
                        </article>
                      ))}
                      {!recommendations.length && <p className="rail-empty">Preparing recommendations…</p>}
                      {explanation && <p className="explanation">{explanation}</p>}
                    </div>
                  ) : (
                    <div className="available-players">
                      <div className="rail-heading">
                        <p className="eyebrow">Player pool</p>
                        <h3>Available players</h3>
                      </div>
                      <input
                        aria-label="Search available players"
                        className="player-search"
                        value={playerQuery}
                        onChange={(event) => setPlayerQuery(event.target.value)}
                        placeholder="Search player or team"
                      />
                      <div className="position-filters" aria-label="Filter by position">
                        {["ALL", "QB", "RB", "WR", "TE"].map((position) => (
                          <button
                            type="button"
                            className={playerPosition === position ? "is-active" : ""}
                            key={position}
                            onClick={() => setPlayerPosition(position)}
                          >
                            {position}
                          </button>
                        ))}
                      </div>
                      <ol className="player-list">
                        {filteredAvailablePlayers.map((player) => (
                          <li key={player.id}>
                            <span className={`position-badge position-${(player.positions[0] ?? "").toLowerCase()}`}>
                              {player.positions[0] ?? "—"}
                            </span>
                            <div>
                              <strong>{player.name}</strong>
                              <small>{player.team ?? "NFL"}</small>
                            </div>
                            <span className="player-adp">{player.adp ? `ADP ${player.adp.toFixed(1)}` : "—"}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          ) : (
            <div className="room-empty">
              <span className="draft-icon">⌁</span>
              <h2>Choose a league to open its draft room</h2>
              <p>
                Expand a league to review its Sleeper draft order, then open the room when you’re
                ready.
              </p>
            </div>
          )}
        </section>
      </div>
      <Dialog.Root
        open={Boolean(importPreview)}
        onOpenChange={(open) => !open && setImportPreview(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="team-dialog">
            <Dialog.Title>Open {importPreview?.league.name}</Dialog.Title>
            <Dialog.Description>
              Choose the team you manage. This can be changed in the draft room later.
            </Dialog.Description>
            <label>
              My team
              <select
                value={importPreview?.selectedTeamSlot ?? ""}
                onChange={(event) =>
                  importPreview &&
                  setImportPreview({
                    ...importPreview,
                    selectedTeamSlot: Number(event.target.value),
                  })
                }
              >
                {importPreview?.teams.map((team) => (
                  <option key={team.slot} value={team.slot}>
                    {team.name} (slot {team.slot})
                  </option>
                ))}
              </select>
            </label>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="secondary">
                  Cancel
                </button>
              </Dialog.Close>
              <button type="button" onClick={() => void confirmLeagueImport()}>
                Open draft room
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
