import { importNflDataset } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { buildAppContainer } from "../../../../../../server/container";
import { apiError } from "../../../../../../server/http";

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const providers = buildAppContainer();
    if (!providers.projections) {
      return NextResponse.json(
        {
          error: {
            code: "PROJECTIONS_NOT_CONFIGURED",
            message: "Add FANTASYPROS_API_KEY first.",
          },
        },
        { status: 503 },
      );
    }
    const season = new Date().getFullYear();
    const [projections, adp] = await Promise.all([
      providers.projections.getProjections({ season }),
      providers.adp.getAdp({ season, scoring: "ppr", teams: 12 }),
    ]);
    return NextResponse.json({ data: await importNflDataset({ projections, adp }) });
  } catch (error) {
    return apiError(error);
  }
}
