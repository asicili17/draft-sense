import { QStashQueue, type DraftSenseJob, type DurableQueue } from "@draft-sense/events";
import { parseEnvironment } from "../env";

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
  return new QStashQueue({
    token: env.QSTASH_TOKEN,
    destination: destination.toString(),
    apiUrl: env.QSTASH_URL,
  });
}

export async function enqueueJob(job: DraftSenseJob, delaySeconds?: number) {
  const queue = jobQueue();
  if (!queue) throw new Error("Background jobs are not configured.");
  return queue.publish(job, delaySeconds === undefined ? undefined : { delaySeconds });
}
