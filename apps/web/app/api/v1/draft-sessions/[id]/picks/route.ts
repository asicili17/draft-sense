import { getDraftSession, prisma } from "@draft-sense/data-access";
import { recordPick, validateRosterPick } from "@draft-sense/draft-engine";
import type { Prisma } from "@prisma/client";
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
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    const session = await getDraftSession(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    if (idempotencyKey) {
      const existing = await prisma.draftPick.findFirst({ where: { sessionId: id, idempotencyKey } });
      if (existing) return NextResponse.json({ data: await getDraftSession(id) });
    }
    const state = recordPick(
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
      {
        overallPick: session.picks.length + 1,
        teamSlot: body.teamSlot,
        playerId: body.playerId,
      },
      body.expectedVersion,
    );
    const team = session.teams.find(
      (candidate: { id: string; slot: number }) => candidate.slot === body.teamSlot,
    );
    if (!team)
      return NextResponse.json(
        { error: { code: "TEAM_NOT_FOUND", message: "Draft team not found." } },
        { status: 422 },
      );
    const player = await prisma.player.findUnique({ where: { id: body.playerId } });
    if (!player || player.sport !== "NFL")
      return NextResponse.json(
        { error: { code: "PLAYER_NOT_FOUND", message: "Draft player not found." } },
        { status: 422 },
      );
    const rosterPositions =
      (session.settings as { rosterPositions?: string[] }).rosterPositions ?? [];
    const draftedPositions = session.picks
      .filter((pick) => pick.teamId === team.id)
      .flatMap((pick) => pick.player.positions);
    validateRosterPick({
      position: player.positions[0] ?? "",
      rosterPositions,
      draftedPositions,
    });
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          idempotencyKey: idempotencyKey || null,
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
