import { importSleeperLeague } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAppContainer } from "../../../../../../server/container";
import { apiError } from "../../../../../../server/http";
import { requireUser } from "../../../../../../server/auth";
const baseSchema = z.object({
  leagueId: z.string().min(1),
  draftId: z.string().min(1),
});
const bodySchema = z.union([
  baseSchema.extend({ preview: z.literal(true) }),
  baseSchema.extend({
    selectedTeamSlot: z.number().int().positive(),
    preview: z.literal(false).optional(),
  }),
]);
export async function POST(request: NextRequest) {
  try {
    const [body, actor] = await Promise.all([
      bodySchema.parse(await request.json()),
      requireUser(),
    ]);
    const sleeper = buildAppContainer().sleeper;
    const [league, draft] = await Promise.all([
      sleeper.getLeagueSnapshot({ leagueId: body.leagueId }),
      sleeper.getDraftSnapshot({ draftId: body.draftId }),
    ]);
    if (body.preview)
      return NextResponse.json({
        data: {
          teams: draft.teams
            .map((team) => ({ slot: team.slot, name: team.name }))
            .sort((left, right) => left.slot - right.slot),
        },
      });
    return NextResponse.json(
      {
        data: await importSleeperLeague({
          league,
          draft,
          ownerId: actor.id,
          selectedTeamSlot: body.selectedTeamSlot,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
