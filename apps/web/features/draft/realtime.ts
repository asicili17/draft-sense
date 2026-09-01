import type { DraftRealtimeEvent } from "@draft-sense/events";

/**
 * Draft updates require a newer board version. Derived recommendation and
 * simulation results may legitimately arrive for the current board version.
 */
export function shouldRefetchForRealtimeEvent(
  event: DraftRealtimeEvent,
  sessionId: string,
  currentSessionVersion: number,
) {
  if (event.sessionId !== sessionId || event.type === "connected") return false;
  if (event.type === "draft.updated") return event.sessionVersion > currentSessionVersion;
  return event.sessionVersion >= currentSessionVersion;
}
