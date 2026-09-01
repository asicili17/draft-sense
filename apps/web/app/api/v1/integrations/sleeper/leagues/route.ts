import { NextRequest, NextResponse } from "next/server";
import { ProviderError } from "@draft-sense/providers";
import { buildAppContainer } from "../../../../../../server/container";
import { requireUser } from "../../../../../../server/auth";
import { prisma } from "@draft-sense/data-access";
import { apiError } from "../../../../../../server/http";
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const connection = await prisma.userPlatformAccount.findUnique({
      where: { userId_provider: { userId: user.id, provider: "sleeper" } },
    });
    const season = Number(request.nextUrl.searchParams.get("season") ?? new Date().getFullYear());
    if (!connection)
      return NextResponse.json(
        {
          error: {
            code: "CONNECTION_REQUIRED",
            message: "Connect a Sleeper account to load leagues.",
          },
        },
        { status: 400 },
      );
    const leagues = await buildAppContainer().sleeper.findLeagues({
      username: connection.username,
      season,
    });
    await prisma.userPlatformAccount.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    });
    return NextResponse.json({ data: leagues });
  } catch (error) {
    if (error instanceof ProviderError)
      return NextResponse.json(
        {
          error: {
            code: `PROVIDER_${error.code}`,
            message: error.message,
          },
        },
        { status: 503 },
      );
    if (error instanceof Error && error.name !== "AuthorizationError") {
      let databaseHost = "not configured";
      try {
        databaseHost = new URL(process.env.DATABASE_URL ?? "").host || databaseHost;
      } catch {
        databaseHost = "invalid URL";
      }
      console.error("Failed to look up Sleeper leagues.", { databaseHost, error });
      return NextResponse.json(
        {
          error: {
            code: "LEAGUE_LOOKUP_FAILED",
            message: "DraftSense could not complete the league lookup. Check the server logs.",
          },
        },
        { status: 500 },
      );
    }
    return apiError(error);
  }
}
