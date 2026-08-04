"use client";
import { useCallback, useEffect, useState } from "react";

type League = { externalLeagueId: string; name: string; draftId?: string };
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
  teams: { name: string; slot: number }[];
  picks: { overallPick: number; player: { fullName: string }; team: { name: string } }[];
  settings?: { source?: { leagueId?: string; draftId?: string } };
};

export function DraftAssistant() {
  const [username, setUsername] = useState("");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [message, setMessage] = useState("");
  const [explanation, setExplanation] = useState("");
  const [source, setSource] = useState<{ leagueId: string; draftId: string } | null>(null);

  const refresh = useCallback(async (id: string) => {
    const [sessionResponse, recommendationResponse] = await Promise.all([
      fetch(`/api/v1/draft-sessions/${id}`, { cache: "no-store" }),
      fetch(`/api/v1/draft-sessions/${id}/recommendations`, { cache: "no-store" }),
    ]);
    const sessionPayload = await sessionResponse.json();
    const recommendationPayload = await recommendationResponse.json();
    if (sessionResponse.ok) setSession(sessionPayload.data);
    if (recommendationResponse.ok) {
      setRecommendations(recommendationPayload.data.recommendations);
      setSnapshotId(recommendationPayload.data.snapshotId);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => void refresh(session.id), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh, session]);

  const findLeagues = async () => {
    setMessage("Looking up your Sleeper leagues…");
    const response = await fetch(`/api/v1/integrations/sleeper/leagues?username=${encodeURIComponent(username)}`);
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    setLeagues(payload.data);
    setMessage(payload.data.length ? "Choose a league to create its draft room." : "No NFL leagues found.");
  };
  const importLeague = async (league: League) => {
    if (!league.draftId) return setMessage("Sleeper has not created a draft for this league yet.");
    setMessage("Creating your draft room…");
    const response = await fetch("/api/v1/draft-sessions/imports/sleeper", {
      method: "POST", headers: { "content-type": "application/json" },
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
    if (!source) return;
    const response = await fetch("/api/v1/draft-sessions/imports/sleeper", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(source),
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
      body: JSON.stringify({ playerId, teamSlot: 1, expectedVersion: session.version, source: "MANUAL" }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    await refresh(session.id);
  };
  const explain = async (playerId: string) => {
    if (!session || !snapshotId) return;
    const response = await fetch(`/api/v1/draft-sessions/${session.id}/recommendations/explanation`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshotId, playerId }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error.message);
    setExplanation(`${payload.data.summary} ${payload.data.uncertainty}`);
  };
  return <section className="assistant">
    <label>Sleeper username<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="your-sleeper-name" /></label>
    <button onClick={findLeagues} disabled={!username}>Find leagues</button>
    <p aria-live="polite">{message}</p>
    {leagues.map((league) => <button className="league" key={league.externalLeagueId} onClick={() => importLeague(league)}>{league.name}</button>)}
    {session && <div className="draft-room">
      <h2>Live draft board</h2><p>Version {session.version} · {session.teams.length} teams</p>
      <ol>{session.picks.map((pick) => <li key={pick.overallPick}>{pick.overallPick}. {pick.player.fullName} — {pick.team.name}</li>)}</ol>
      <button onClick={refreshFromSleeper} disabled={!source}>Refresh from Sleeper</button>
      <h3>Recommendations</h3>
      {recommendations.slice(0, 5).map((item) => <article className="recommendation" key={item.playerId}>
        <strong>{item.name}</strong><span> Score {item.score} · confidence {Math.round(item.confidence * 100)}%</span>
        <small>VORP {item.factors.vorp.toFixed(1)} · roster fit {item.factors.rosterFit.toFixed(2)}</small>
        <div><button onClick={() => recordPick(item.playerId)}>Record as my pick</button><button className="secondary" onClick={() => explain(item.playerId)}>Why?</button></div>
      </article>)}
      {explanation && <p className="explanation">{explanation}</p>}
    </div>}
  </section>;
}
