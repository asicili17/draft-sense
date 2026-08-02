import { NextRequest, NextResponse } from "next/server";
import { buildAppContainer } from "../../../../../../server/container";
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim();
  const season = Number(request.nextUrl.searchParams.get("season") ?? new Date().getFullYear());
  if (!username) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "A Sleeper username is required." } }, { status: 400 });
  try { return NextResponse.json({ data: await buildAppContainer().sleeper.findLeagues({ username, season }) }); }
  catch { return NextResponse.json({ error: { code: "PROVIDER_UNAVAILABLE", message: "Sleeper could not be reached." } }, { status: 503 }); }
}
