import { getDraftSession, prisma } from "@draft-sense/data-access";
import { DraftDomainError, undoLatestPick } from "@draft-sense/draft-engine";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionAccess } from "../../../../../../../server/auth";
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
    const { session: authorizedSession } = await requireSessionAccess(id, true);
    if (!authorizedSession)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
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
        picks: session.picks.map(
          (pick: { overallPick: number; playerId: string; team: { slot: number } }) => ({
            overallPick: pick.overallPick,
            teamSlot: pick.team.slot,
            playerId: pick.playerId,
          }),
        ),
      },
      body.expectedVersion,
    );
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.draftPick.deleteMany({
        where: {
          sessionId: id,
          overallPick: Number(overallPick),
        },
      });
      if (deleted.count !== 1)
        throw new DraftDomainError(
          "VERSION_CONFLICT",
          "This draft changed. Refresh and try again.",
        );
      const updated = await tx.draftSession.updateMany({
        where: {
          id,
          version: body.expectedVersion,
        },
        data: { version: state.version },
      });
      if (updated.count !== 1)
        throw new DraftDomainError(
          "VERSION_CONFLICT",
          "This draft changed. Refresh and try again.",
        );
      await tx.outboxEvent.create({
        data: {
          sessionId: id,
          type: "draft.pick.undone",
          payload: { overallPick: Number(overallPick) },
        },
      });
    });
    return NextResponse.json({ data: await getDraftSession(id) });
  } catch (error) {
    return apiError(error);
  }
}
