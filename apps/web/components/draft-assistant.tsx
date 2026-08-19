"use client";

import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  picks: { overallPick: number; player: { fullName: string }; team: { name: string } }[];
  settings?: { source?: { leagueId?: string; draftId?: string } };
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
                  <p className="eyebrow">Live draft room</p>
                  <h2>
                    {session.teams.length} teams · board v{session.version}
                  </h2>
                  <small className="realtime-status">
                    {realtime.status === "connected"
                      ? "Live updates connected"
                      : "Live updates reconnecting; polling remains active"}
                  </small>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void refreshFromSleeper()}
                  disabled={!source}
                >
                  Refresh
                </button>
              </div>
              <label className="team-select">
                My draft team
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
              <div className="room-columns">
                <section className="draft-board">
                  <h3>Draft board</h3>
                  {session.picks.length ? (
                    <ol>
                      {[...session.picks].reverse().map((pick) => (
                        <li key={pick.overallPick}>
                          <span>{pick.overallPick}</span>
                          <strong>{pick.player.fullName}</strong>
                          <small>{pick.team.name}</small>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>No picks have been recorded.</p>
                  )}
                </section>
                <section className="recommendations">
                  <h3>On the clock</h3>
                  {recommendations.slice(0, 5).map((item) => (
                    <article key={item.playerId}>
                      <strong>{item.name}</strong>
                      <span>
                        Score {item.score} · {Math.round(item.confidence * 100)}% confidence
                      </span>
                      <small>
                        {item.reason} VORP {item.factors.vorp.toFixed(1)} · roster fit{" "}
                        {item.factors.rosterFit.toFixed(2)}
                      </small>
                      <div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void explain(item.playerId)}
                          disabled={Boolean(explainingPlayerId)}
                        >
                          {explainingPlayerId === item.playerId ? "Loading…" : "Why?"}
                        </button>
                      </div>
                    </article>
                  ))}
                  <p className="message">
                    Picks are made in Sleeper. DraftSense updates recommendations after it detects
                    the latest Sleeper draft board.
                  </p>
                  {explanation && <p className="explanation">{explanation}</p>}
                </section>
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
