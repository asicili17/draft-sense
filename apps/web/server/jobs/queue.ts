import { type DraftSenseJob, type DurableQueue } from "@draft-sense/events";
import { Client } from "@upstash/qstash";
import { parseEnvironment } from "../env";

class QStashDurableQueue implements DurableQueue {
  constructor(
    private readonly client: Client,
    private readonly destination: string,
  ) {}

  async publish(job: DraftSenseJob, options: { delaySeconds?: number } = {}) {
    const result = await this.client.publishJSON({
      url: this.destination,
      body: job,
      ...(options.delaySeconds === undefined ? {} : { delay: options.delaySeconds }),
    });
    return { messageId: result.messageId };
  }
}

export function jobQueue(): DurableQueue | undefined {
  const env = parseEnvironment();
  if (!env.QSTASH_TOKEN || !env.APP_URL) return undefined;
  const destination = new URL("/api/jobs/execute", env.APP_URL);
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    destination.searchParams.set(
      "x-vercel-protection-bypass",
      env.VERCEL_AUTOMATION_BYPASS_SECRET,
    );
  }
  return new QStashDurableQueue(
    new Client({ token: env.QSTASH_TOKEN, baseUrl: env.QSTASH_URL, devMode: false }),
    destination.toString(),
  );
}

export async function enqueueJob(job: DraftSenseJob, delaySeconds?: number) {
  const queue = jobQueue();
  if (!queue) throw new Error("Background jobs are not configured.");
  return queue.publish(job, delaySeconds === undefined ? undefined : { delaySeconds });
}
