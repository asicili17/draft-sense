import { getDraftSession, prisma } from "@draft-sense/data-access";
import { recordPick } from "@draft-sense/draft-engine";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../../server/http";
const bodySchema = z.object({
  playerId: z.string().uuid(),
  teamSlot: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  source: z.enum(["SLEEPER", "MANUAL"]).default("MANUAL"),
});
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const body = bodySchema.parse(await request.json());
    const session = await getDraftSession(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const state = recordPick(
      {
        teamCount: session.teamCount,
        version: session.version,
        picks: session.picks.map((pick) => ({
          overallPick: pick.overallPick,
          teamSlot: pick.team.slot,
          playerId: pick.playerId,
        })),
      },
      {
        overallPick: session.picks.length + 1,
        teamSlot: body.teamSlot,
        playerId: body.playerId,
      },
      body.expectedVersion,
    );
    const team = session.teams.find((candidate) => candidate.slot === body.teamSlot);
    if (!team)
      return NextResponse.json(
        { error: { code: "TEAM_NOT_FOUND", message: "Draft team not found." } },
        { status: 422 },
      );
    await prisma.$transaction(async (tx) => {
      const updated = await tx.draftSession.updateMany({
        where: { id, version: body.expectedVersion },
        data: { version: state.version },
      });
      if (updated.count !== 1) throw new Error("This draft changed. Refresh and try again.");
      await tx.draftPick.create({
        data: {
          sessionId: id,
          overallPick: state.picks.length,
          round: Math.ceil(state.picks.length / session.teamCount),
          teamId: team.id,
          playerId: body.playerId,
          source: body.source,
        },
      });
      await tx.outboxEvent.create({
        data: {
          sessionId: id,
          type: "draft.pick.recorded",
          payload: { overallPick: state.picks.length, playerId: body.playerId },
        },
      });
    });
    return NextResponse.json({ data: await getDraftSession(id) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
