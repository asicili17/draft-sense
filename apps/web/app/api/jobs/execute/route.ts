import { isDraftSenseJob } from "@draft-sense/events";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { parseEnvironment } from "../../../../server/env";
import { executeJob } from "../../../../server/jobs/worker";
import { jobTelemetry } from "../../../../server/jobs/telemetry";

async function executeVerifiedJob(request: NextRequest) {
  const body = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    jobTelemetry("job.invalid_payload", { reason: "invalid_json" });
    return NextResponse.json({ error: "Invalid JSON job." }, { status: 400 });
  }
  if (!isDraftSenseJob(payload)) {
    jobTelemetry("job.invalid_payload", { reason: "invalid_job" });
    return NextResponse.json({ error: "Invalid job." }, { status: 400 });
  }
  jobTelemetry("job.request_received", {
    type: payload.type,
    sessionId: payload.sessionId,
    sessionVersion: payload.sessionVersion,
  });
  await executeJob(payload);
  return NextResponse.json({ data: { accepted: true } });
}

export async function POST(request: NextRequest) {
  const env = parseEnvironment();
  // `verifySignatureAppRouter` creates its verifier as soon as it is called.
  // Keep that work inside the request handler so Next can build this route in
  // CI without production queue secrets. A deployed worker remains closed when
  // its signing keys are absent instead of processing an unverified job.
  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
    jobTelemetry("job.not_configured", { reason: "missing_qstash_signing_keys" });
    return NextResponse.json({ error: "QStash job verification is not configured." }, { status: 503 });
  }
  return verifySignatureAppRouter(executeVerifiedJob, {
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  })(request);
}
