import { Redis } from "@upstash/redis";
import { Realtime } from "@upstash/realtime";
import type { DraftRealtimeEvent } from "@draft-sense/events";
import { parseEnvironment } from "../env";
import { jobTelemetry } from "../jobs/telemetry";

type PublicRealtimeEvent = Extract<
  DraftRealtimeEvent,
  { type: Exclude<DraftRealtimeEvent["type"], "connected"> }
>;

function realtime() {
  const env = parseEnvironment();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return undefined;
  return new Realtime({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    history: { maxLength: 20, expireAfterSecs: 300 },
  });
}

export const draftChannel = (sessionId: string) => `draft:${sessionId}`;

export async function publishDraftUpdate(event: PublicRealtimeEvent) {
  const delivery = realtime();
  if (!delivery) return false;
  try {
    // The shared event contract is deliberately version-only. The browser always
    // refetches authoritative data after receiving it.
    await (delivery.channel(draftChannel(event.sessionId)).emit as (
      type: string,
      data: PublicRealtimeEvent,
    ) => Promise<void>)(event.type, event);
    return true;
  } catch (error) {
    jobTelemetry("realtime.publish_failed", {
      type: event.type,
      sessionId: event.sessionId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

export function upstashRealtime() {
  return realtime();
}
