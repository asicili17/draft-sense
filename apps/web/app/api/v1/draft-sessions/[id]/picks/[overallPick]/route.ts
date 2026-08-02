import { getDraftSession, prisma } from "@draft-sense/data-access";
import { undoLatestPick } from "@draft-sense/draft-engine";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../../../server/http";
const bodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; overallPick: string }> },
) {
  try {
    const { id, overallPick } = await context.params;
    const body = bodySchema.parse(await request.json());
    const session = await getDraftSession(id);
    if (!session || Number(overallPick) !== session.picks.length)
      return NextResponse.json(
        {
          error: {
            code: "UNDO_NOT_ALLOWED",
            message: "Only the latest pick can be undone.",
          },
        },
        { status: 422 },
      );
    const state = undoLatestPick(
      {
        teamCount: session.teamCount,
        version: session.version,
        picks: session.picks.map((pick) => ({
          overallPick: pick.overallPick,
          teamSlot: pick.team.slot,
          playerId: pick.playerId,
        })),
      },
      body.expectedVersion,
    );
    await prisma.$transaction([
      prisma.draftPick.delete({
        where: {
          sessionId_overallPick: {
            sessionId: id,
            overallPick: Number(overallPick),
          },
        },
      }),
      prisma.draftSession.update({
        where: { id },
        data: { version: state.version },
      }),
      prisma.outboxEvent.create({
        data: {
          sessionId: id,
          type: "draft.pick.undone",
          payload: { overallPick: Number(overallPick) },
        },
      }),
    ]);
    return NextResponse.json({ data: await getDraftSession(id) });
  } catch (error) {
    return apiError(error);
  }
}
