import { draftablePlayers } from "@draft-sense/data-access";
import { NextResponse } from "next/server";
import { requireSessionAccess } from "../../../../../../server/auth";
import { apiError } from "../../../../../../server/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { session } = await requireSessionAccess(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );

    const players = await draftablePlayers(id);
    return NextResponse.json({
      data: players.map((projection) => ({
        id: projection.player.id,
        name: projection.player.fullName,
        team: projection.player.team,
        positions: projection.player.positions,
        projectedPoints: projection.projectedPoints,
        adp: projection.adp,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
