import { prisma } from "@draft-sense/data-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "../../../../../../server/auth";
import { buildAppContainer } from "../../../../../../server/container";
import { apiError } from "../../../../../../server/http";

const bodySchema = z.object({ username: z.string().trim().min(1).max(64) });
const provider = "sleeper";

export async function GET() {
  try {
    const user = await requireUser();
    const connection = await prisma.userPlatformAccount.findUnique({
      where: { userId_provider: { userId: user.id, provider } },
    });
    if (!connection)
      return NextResponse.json(
        { error: { code: "NOT_CONNECTED", message: "No Sleeper account is connected." } },
        { status: 404 },
      );
    return NextResponse.json({
      data: {
        username: connection.username,
        externalUserId: connection.externalUserId,
        connectedAt: connection.connectedAt,
        lastSyncedAt: connection.lastSyncedAt,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [body, user] = await Promise.all([bodySchema.parse(await request.json()), requireUser()]);
    const sleeperUser = await buildAppContainer().sleeper.getUser({ username: body.username });
    const connection = await prisma.userPlatformAccount.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      update: {
        username: sleeperUser.username,
        externalUserId: sleeperUser.externalUserId,
        metadata: {
          displayName: sleeperUser.displayName ?? null,
          avatar: sleeperUser.avatar ?? null,
        },
        lastSyncedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider,
        username: sleeperUser.username,
        externalUserId: sleeperUser.externalUserId,
        metadata: {
          displayName: sleeperUser.displayName ?? null,
          avatar: sleeperUser.avatar ?? null,
        },
        lastSyncedAt: new Date(),
      },
    });
    return NextResponse.json({
      data: { username: connection.username, externalUserId: connection.externalUserId },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.userPlatformAccount.deleteMany({ where: { userId: user.id, provider } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
