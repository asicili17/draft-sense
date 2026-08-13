import { getDraftSession } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionAccess, selectDraftTeam } from "../../../../../server/auth";
import { apiError } from "../../../../../server/http";
import { enqueueJob } from "../../../../../server/jobs/queue";
import { parseEnvironment } from "../../../../../server/env";
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
    const becameActive =
      Date.now() - session.lastViewedAt.getTime() > parseEnvironment().LIVE_DRAFT_POLL_SECONDS * 3_000;
    await import("@draft-sense/data-access").then(({ prisma }) =>
      prisma.draftSession.update({ where: { id }, data: { lastViewedAt: new Date() } }),
    );
    // Restart a stopped active-draft refresh loop when a user reopens the room.
    if (becameActive && session.status === "LIVE")
      await enqueueJob({ type: "sleeper.refresh.requested", sessionId: id }).catch(() => undefined);
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
/** Starts the server-side Sleeper refresh loop when a user opens this room. */
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { session } = await requireSessionAccess(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    await import("@draft-sense/data-access").then(({ prisma }) =>
      prisma.draftSession.update({ where: { id }, data: { lastViewedAt: new Date() } }),
    );
    // The worker re-reads the session and exits immediately for completed drafts.
    await enqueueJob({ type: "sleeper.refresh.requested", sessionId: id });
    return NextResponse.json({ data: { activated: true } });
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
