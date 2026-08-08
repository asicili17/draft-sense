import { isDraftSenseJob } from "@draft-sense/events";
import { NextRequest, NextResponse } from "next/server";
import { executeJob } from "../../../../server/jobs/worker";
import { verifyQStashRequest } from "../../../../server/jobs/qstash-auth";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const expectedUrl = `${process.env.APP_URL}/api/jobs/execute`;
  const verified = await verifyQStashRequest({
    signature: request.headers.get("upstash-signature"),
    body,
    expectedUrl,
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
  if (!verified)
    return new NextResponse("Unauthorized", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON job." }, { status: 400 });
  }
  if (!isDraftSenseJob(payload)) return NextResponse.json({ error: "Invalid job." }, { status: 400 });
  await executeJob(payload);
  return NextResponse.json({ data: { accepted: true } });
}
