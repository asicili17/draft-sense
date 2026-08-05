import { prisma } from "@draft-sense/data-access";
import { NextResponse } from "next/server";
import { requireUser } from "../../../../server/auth";
import { apiError } from "../../../../server/http";

export async function GET() {
  try {
    const user = await requireUser();
    const selections = await prisma.userDraftTeamSelection.findMany({
      where: { userId: user.id, session: { ownerId: user.id } },
      include: { team: true, session: { include: { league: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      data: selections.map((selection) => ({
        sessionId: selection.session.id,
        leagueName: selection.session.league?.name ?? "Draft room",
        status: selection.session.status,
        selectedTeam: {
          id: selection.team.id,
          name: selection.team.name,
          slot: selection.team.slot,
        },
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
