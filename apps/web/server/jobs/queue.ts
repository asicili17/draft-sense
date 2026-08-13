import { type DraftSenseJob, type DurableQueue } from "@draft-sense/events";
import { Client } from "@upstash/qstash";
import { parseEnvironment } from "../env";

class QStashDurableQueue implements DurableQueue {
  constructor(
    private readonly client: Client,
    private readonly destination: string,
    private readonly headers?: Record<string, string>,
  ) {}

  async publish(job: DraftSenseJob, options: { delaySeconds?: number } = {}) {
    const result = await this.client.publishJSON({
      url: this.destination,
      body: job,
      ...(this.headers ? { headers: this.headers } : {}),
      ...(options.delaySeconds === undefined ? {} : { delay: options.delaySeconds }),
    });
    if (!("messageId" in result)) throw new Error("QStash did not return a message ID.");
    return { messageId: result.messageId };
  }
}

export function jobQueue(): DurableQueue | undefined {
  const env = parseEnvironment();
  if (!env.QSTASH_TOKEN || !env.APP_URL) return undefined;
  const destination = new URL("/api/jobs/execute", env.APP_URL);
  return new QStashDurableQueue(
    new Client({ token: env.QSTASH_TOKEN, baseUrl: env.QSTASH_URL, devMode: false }),
    destination.toString(),
    env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
  );
}

export async function enqueueJob(job: DraftSenseJob, delaySeconds?: number) {
  const queue = jobQueue();
  if (!queue) throw new Error("Background jobs are not configured.");
  return queue.publish(job, delaySeconds === undefined ? undefined : { delaySeconds });
}
