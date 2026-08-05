import { getDraftSession } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionAccess, selectDraftTeam } from "../../../../../server/auth";
import { apiError } from "../../../../../server/http";
const updateSchema = z.object({ selectedTeamId: z.string().uuid() });
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { user, session: access } = await requireSessionAccess(id);
    const session = access && (await getDraftSession(id));
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const selectedTeam = await import("@draft-sense/data-access").then(({ prisma }) =>
      prisma.userDraftTeamSelection.findUnique({
        where: { userId_sessionId: { userId: user.id, sessionId: id } },
      }),
    );
    return NextResponse.json({
      data: { ...session, selectedTeamId: selectedTeam?.teamId ?? null },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { user, session } = await requireSessionAccess(id, true);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const team = await selectDraftTeam(
      id,
      user.id,
      updateSchema.parse(await request.json()).selectedTeamId,
    );
    return NextResponse.json({ data: { selectedTeamId: team.id, selectedTeamSlot: team.slot } });
  } catch (error) {
    return apiError(error);
  }
}
