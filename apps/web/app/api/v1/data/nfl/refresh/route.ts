import { importNflDataset } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { buildAppContainer } from "../../../../../../server/container";
import { apiError } from "../../../../../../server/http";
import { publishPendingOutbox } from "../../../../../../server/jobs/outbox-publisher";

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    // Do not use Authorization here: Clerk processes that header before this
    // route and treats a CRON_SECRET as an invalid session JWT.
    if (!secret || request.headers.get("x-draftsense-cron-secret") !== secret) {
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
    const [projections, adp, marketRankings] = await Promise.all([
      providers.projections.getProjections({ season }),
      providers.adp.getAdp({ season, scoring: "ppr", teams: 12 }),
      Promise.all(
        (["standard", "half-ppr", "ppr"] as const).map((scoring) =>
          providers.marketRankings?.getConsensusRankings({ season, scoring }),
        ),
      ),
    ]);
    const dataset = await importNflDataset({
      projections,
      adp,
      marketRankings: marketRankings.filter((ranking): ranking is NonNullable<typeof ranking> =>
        Boolean(ranking),
      ),
    });
    const outbox = await publishPendingOutbox();
    return NextResponse.json({ data: { dataset, outbox } });
  } catch (error) {
    return apiError(error);
  }
}
