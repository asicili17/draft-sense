import { claimOutboxEvents, markOutboxDelivered, releaseOutboxEvent } from "@draft-sense/data-access";
import { isDraftSenseJob } from "@draft-sense/events";
import { enqueueJob } from "./queue";
import { jobTelemetry } from "./telemetry";

export async function publishPendingOutbox(limit = 25) {
  const claimed = await claimOutboxEvents(limit);
  let delivered = 0;
  for (const event of claimed) {
    const payload = event.payload as Record<string, unknown>;
    const candidate = {
      type: event.type,
      sessionId: event.sessionId,
      eventId: event.id,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : undefined,
    };
    try {
      if (!isDraftSenseJob(candidate)) throw new Error(`Unknown outbox event '${event.type}'.`);
      const queued = await enqueueJob(candidate);
      await markOutboxDelivered(event.id, event.leaseToken, queued.messageId);
      jobTelemetry("outbox.delivered", { eventId: event.id, type: event.type, sessionId: event.sessionId, queueMessageId: queued.messageId });
      delivered += 1;
    } catch (error) {
      await releaseOutboxEvent(event.id, event.leaseToken, error);
      jobTelemetry("outbox.publish_failed", { eventId: event.id, type: event.type, sessionId: event.sessionId, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return { claimed: claimed.length, delivered };
}
