import { isDraftSenseJob } from "@draft-sense/events";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { executeJob } from "../../../../server/jobs/worker";
import { jobTelemetry } from "../../../../server/jobs/telemetry";

export const POST = verifySignatureAppRouter(async (request: NextRequest) => {
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
});
