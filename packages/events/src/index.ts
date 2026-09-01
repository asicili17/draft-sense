export const JOB_TYPES = [
  "draft.pick.recorded",
  "sleeper.refresh.requested",
  "recommendations.recompute",
  "simulation.run",
] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type DraftSenseJob = {
  type: JobType;
  sessionId: string;
  sessionVersion?: number;
  eventId?: string;
};

/** Public, one-way notification sent to an authorized draft-room client. */
export type DraftRealtimeEvent =
  | { type: "connected"; sessionId: string; sessionVersion: number }
  | { type: "draft.updated"; sessionId: string; sessionVersion: number }
  | { type: "recommendations.updated"; sessionId: string; sessionVersion: number }
  | { type: "simulation.updated"; sessionId: string; sessionVersion: number };

export function isDraftSenseJob(value: unknown): value is DraftSenseJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Record<string, unknown>;
  return (
    typeof job.sessionId === "string" &&
    typeof job.type === "string" &&
    (JOB_TYPES as readonly string[]).includes(job.type) &&
    (job.sessionVersion === undefined || typeof job.sessionVersion === "number") &&
    (job.eventId === undefined || typeof job.eventId === "string")
  );
}

export interface DurableQueue {
  publish(job: DraftSenseJob, options?: { delaySeconds?: number }): Promise<{ messageId: string }>;
}
