import { NextRequest, NextResponse } from "next/server";
import { ProviderError } from "@draft-sense/providers";
import { buildAppContainer } from "../../../../../../server/container";
import { requireUser } from "../../../../../../server/auth";
import { apiError } from "../../../../../../server/http";
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const username = request.nextUrl.searchParams.get("username")?.trim();
    const season = Number(request.nextUrl.searchParams.get("season") ?? new Date().getFullYear());
    if (!username)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "A Sleeper username is required.",
          },
        },
        { status: 400 },
      );
    return NextResponse.json({
      data: await buildAppContainer().sleeper.findLeagues({ username, season }),
    });
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
      console.error("Failed to look up Sleeper leagues.", error);
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
