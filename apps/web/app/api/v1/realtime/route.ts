import { handle } from "@upstash/realtime";
import { NextResponse } from "next/server";
import { authorizeDraftChannels } from "../../../../server/realtime/authorization";
import { upstashRealtime } from "../../../../server/realtime/upstash";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const realtime = upstashRealtime();
  if (!realtime)
    return NextResponse.json(
      { error: { code: "REALTIME_NOT_CONFIGURED", message: "Live updates are not configured." } },
      { status: 503 },
    );
  const response = await handle({
    realtime,
    middleware: async ({ channels }) => authorizeDraftChannels(channels),
  })(request);
  return response ?? new Response("Bad request", { status: 400 });
}
