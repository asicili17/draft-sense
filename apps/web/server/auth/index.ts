import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@draft-sense/data-access";

export class AuthorizationError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "TEAM_NOT_SELECTED",
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type AuthenticatedUser = { id: string; clerkUserId: string };

export async function requireUser(): Promise<AuthenticatedUser> {
  const { userId } = await auth();
  if (!userId) throw new AuthorizationError("UNAUTHENTICATED", "Sign in to continue.");

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? `${userId}@clerk.invalid`;
  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    "DraftSense user";
  const existing = await prisma.user.findFirst({
    where: { OR: [{ clerkUserId: userId }, { email }] },
  });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { clerkUserId: userId, email, displayName },
      })
    : await prisma.user.create({ data: { clerkUserId: userId, email, displayName } });
  return { id: user.id, clerkUserId: userId };
}

export async function requireSessionAccess(sessionId: string, _write = false) {
  const user = await requireUser();
  const session = await prisma.draftSession.findUnique({
    where: { id: sessionId },
    select: { id: true, ownerId: true },
  });
  if (!session) return { user, session: null };
  if (session.ownerId !== user.id)
    throw new AuthorizationError("FORBIDDEN", "You do not own this draft session.");
  return { user, session };
}

export async function requireSelectedTeam(sessionId: string, userId: string) {
  const selection = await prisma.userDraftTeamSelection.findUnique({
    where: { userId_sessionId: { userId, sessionId } },
    include: { team: true },
  });
  if (!selection)
    throw new AuthorizationError(
      "TEAM_NOT_SELECTED",
      "Select your draft team before making this request.",
    );
  if (selection.team.sessionId !== sessionId)
    throw new AuthorizationError("FORBIDDEN", "The selected draft team is not in this session.");
  return selection.team;
}

export async function selectDraftTeam(sessionId: string, userId: string, teamId: string) {
  const team = await prisma.draftTeam.findFirst({ where: { id: teamId, sessionId } });
  if (!team)
    throw new AuthorizationError("FORBIDDEN", "The selected team is not in this draft session.");
  await prisma.userDraftTeamSelection.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    update: { teamId },
    create: { userId, sessionId, teamId },
  });
  return team;
}
