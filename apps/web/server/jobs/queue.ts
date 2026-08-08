import { QStashQueue, type DraftSenseJob, type DurableQueue } from "@draft-sense/events";
import { parseEnvironment } from "../env";

export function jobQueue(): DurableQueue | undefined {
  const env = parseEnvironment();
  if (!env.QSTASH_TOKEN || !env.APP_URL) return undefined;
  return new QStashQueue({
    token: env.QSTASH_TOKEN,
    destination: `${env.APP_URL}/api/jobs/execute`,
  });
}

export async function enqueueJob(job: DraftSenseJob, delaySeconds?: number) {
  const queue = jobQueue();
  if (!queue) throw new Error("Background jobs are not configured.");
  return queue.publish(job, delaySeconds === undefined ? undefined : { delaySeconds });
}
