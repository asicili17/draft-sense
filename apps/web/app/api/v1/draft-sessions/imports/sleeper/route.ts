import { importSleeperLeague } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAppContainer } from "../../../../../../server/container";
import { apiError } from "../../../../../../server/http";
const bodySchema = z.object({
  leagueId: z.string().min(1),
  draftId: z.string().min(1),
});
export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const sleeper = buildAppContainer().sleeper;
    const [league, draft] = await Promise.all([
      sleeper.getLeagueSnapshot({ leagueId: body.leagueId }),
      sleeper.getDraftSnapshot({ draftId: body.draftId }),
    ]);
    return NextResponse.json(
      { data: await importSleeperLeague({ league, draft }) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
