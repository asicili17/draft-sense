"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type League = { externalLeagueId: string; name: string; draftId?: string };
type ImportPreview = {
  league: League;
  teams: { slot: number; name: string }[];
  selectedTeamSlot: number;
};
type Recommendation = {
  playerId: string;
  name: string;
  score: number;
  confidence: number;
  factors: { vorp: number; scarcity: number; rosterFit: number };
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
  const { isSignedIn } = useAuth();
  const [username, setUsername] = useState("");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [message, setMessage] = useState("");
  const [explanation, setExplanation] = useState("");
  const [source, setSource] = useState<{ leagueId: string; draftId: string } | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [savedRooms, setSavedRooms] = useState<SavedDraftRoom[]>([]);

  const refresh = useCallback(async (id: string) => {
    const [sessionResponse, recommendationResponse] = await Promise.all([
      fetch(`/api/v1/draft-sessions/${id}`, { cache: "no-store" }),
      fetch(`/api/v1/draft-sessions/${id}/recommendations`, { cache: "no-store" }),
    ]);
    const sessionPayload = await sessionResponse.json();
    const recommendationPayload = await recommendationResponse.json();
    if (sessionResponse.ok) {
      setSession(sessionPayload.data);
      const importedSource = sessionPayload.data.settings?.source;
      if (importedSource?.leagueId && importedSource?.draftId) setSource(importedSource);
    }
    if (recommendationResponse.ok) {
      setRecommendations(recommendationPayload.data.recommendations);
      setSnapshotId(recommendationPayload.data.snapshotId);
    }
  }, []);

  const loadSavedRooms = useCallback(async () => {
    const response = await fetch("/api/v1/draft-sessions", { cache: "no-store" });
    if (!response.ok) return setSavedRooms([]);
    const payload = await response.json();
    setSavedRooms(payload.data);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return setSavedRooms([]);
    void loadSavedRooms();
  }, [isSignedIn, loadSavedRooms]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => void refresh(session.id), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh, session]);

  const findLeagues = async () => {
    setMessage("Looking up your Sleeper leagues…");
    const response = await fetch(
      `/api/v1/integrations/sleeper/leagues?username=${encodeURIComponent(username)}`,
    );
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    setLeagues(payload.data);
    setMessage(
      payload.data.length ? "Choose a league to create its draft room." : "No NFL leagues found.",
    );
  };
  const previewLeagueImport = async (league: League) => {
    if (!league.draftId) return setMessage("Sleeper has not created a draft for this league yet.");
    setMessage("Loading league teams...");
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
    const teams = payload.data.teams as { slot: number; name: string }[];
    const firstTeam = teams[0];
    if (!firstTeam) return setMessage("Sleeper did not return any draft teams for this league.");
    setImportPreview({ league, teams, selectedTeamSlot: firstTeam.slot });
    setMessage("Choose your team before creating this private draft room.");
  };
  const confirmLeagueImport = async () => {
    if (!importPreview?.league.draftId) return;
    setMessage("Creating your draft room...");
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
    setMessage("Draft room synchronized. The board refreshes every 10 seconds.");
  };

  const openSavedRoom = async (savedRoom: SavedDraftRoom) => {
    setMessage(`Opening ${savedRoom.leagueName}…`);
    await refresh(savedRoom.sessionId);
    setMessage(`${savedRoom.leagueName} is open.`);
  };
  const importLeague = async (league: League) => {
    if (!league.draftId) return setMessage("Sleeper has not created a draft for this league yet.");
    setMessage("Creating your draft room…");
    const response = await fetch("/api/v1/draft-sessions/imports/sleeper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leagueId: league.externalLeagueId, draftId: league.draftId }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    setSession(payload.data);
    const importedSource = payload.data.settings?.source;
    if (importedSource?.leagueId && importedSource?.draftId) setSource(importedSource);
    await refresh(payload.data.id);
    setMessage("Draft room synchronized. The board refreshes every 10 seconds.");
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
  const recordPick = async (playerId: string) => {
    if (!session) return;
    const response = await fetch(`/api/v1/draft-sessions/${session.id}/picks`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ playerId, expectedVersion: session.version, source: "MANUAL" }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    await refresh(session.id);
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
    if (!session || !snapshotId) return;
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
  };
  return (
    <section className="assistant">
      {isSignedIn && savedRooms.length > 0 && (
        <section className="saved-draft-rooms" aria-label="Your draft rooms">
          <h2>Your draft rooms</h2>
          {savedRooms.map((savedRoom) => (
            <button key={savedRoom.sessionId} onClick={() => void openSavedRoom(savedRoom)}>
              Open {savedRoom.leagueName} — {savedRoom.selectedTeam.name} (slot {savedRoom.selectedTeam.slot})
            </button>
          ))}
        </section>
      )}
      <label>
        Sleeper username
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your-sleeper-name"
        />
      </label>
      <button onClick={findLeagues} disabled={!username}>
        Find leagues
      </button>
      <p aria-live="polite">{message}</p>
      {leagues.map((league) => (
        <button
          className="league"
          key={league.externalLeagueId}
          onClick={() => void previewLeagueImport(league)}
        >
          {league.name}
        </button>
      ))}
      {importPreview && (
        <section className="team-preview" aria-label="Choose your draft team">
          <h2>{importPreview.league.name}</h2>
          <label>
            Which team is yours?
            <select
              value={importPreview.selectedTeamSlot}
              onChange={(event) =>
                setImportPreview({ ...importPreview, selectedTeamSlot: Number(event.target.value) })
              }
            >
              {importPreview.teams.map((team) => (
                <option key={team.slot} value={team.slot}>
                  {team.name} (slot {team.slot})
                </option>
              ))}
            </select>
          </label>
          <div>
            <button onClick={() => void confirmLeagueImport()}>Create private draft room</button>
            <button className="secondary" onClick={() => setImportPreview(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      {session && (
        <div className="draft-room">
          <h2>Live draft board</h2>
          <p>
            Version {session.version} · {session.teams.length} teams
          </p>
          <label>
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
          <ol>
            {session.picks.map((pick) => (
              <li key={pick.overallPick}>
                {pick.overallPick}. {pick.player.fullName} — {pick.team.name}
              </li>
            ))}
          </ol>
          <button onClick={refreshFromSleeper} disabled={!source}>
            Refresh from Sleeper
          </button>
          <h3>Recommendations</h3>
          {recommendations.slice(0, 5).map((item) => (
            <article className="recommendation" key={item.playerId}>
              <strong>{item.name}</strong>
              <span>
                {" "}
                Score {item.score} · confidence {Math.round(item.confidence * 100)}%
              </span>
              <small>
                VORP {item.factors.vorp.toFixed(1)} · roster fit {item.factors.rosterFit.toFixed(2)}
              </small>
              <div>
                <button onClick={() => recordPick(item.playerId)}>Record as my pick</button>
                <button className="secondary" onClick={() => explain(item.playerId)}>
                  Why?
                </button>
              </div>
            </article>
          ))}
          {explanation && <p className="explanation">{explanation}</p>}
        </div>
      )}
    </section>
  );
}
