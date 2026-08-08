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
export type DraftRealtimeEvent = {
  type: "connected" | "draft.updated" | "recommendations.updated" | "simulation.updated";
  sessionId: string;
  sessionVersion: number;
};

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

/** HTTP-push queue adapter. QStash delivers the payload to a protected app route. */
export class QStashQueue implements DurableQueue {
  constructor(
    private readonly input: { token: string; destination: string; apiUrl?: string },
  ) {}

  async publish(job: DraftSenseJob, options: { delaySeconds?: number } = {}) {
    const response = await fetch(
      `${this.input.apiUrl ?? "https://qstash.upstash.io"}/v2/publish/${this.input.destination}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.input.token}`,
          "Content-Type": "application/json",
          ...(options.delaySeconds ? { "Upstash-Delay": `${options.delaySeconds}s` } : {}),
        },
        body: JSON.stringify(job),
      },
    );
    if (!response.ok) throw new Error(`QStash publish failed with ${response.status}.`);
    const body = (await response.json()) as { messageId?: string };
    return { messageId: body.messageId ?? "unknown" };
  }
}
