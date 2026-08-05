import { NextRequest, NextResponse } from "next/server";
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
    if (error instanceof Error && error.name !== "AuthorizationError")
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "Sleeper could not be reached.",
          },
        },
        { status: 503 },
      );
    return apiError(error);
  }
}
