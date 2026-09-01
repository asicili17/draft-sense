-- Clerk identity is external; DraftSense owns each imported league and its selected roster.

ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

ALTER TABLE "DraftPick" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "DraftPick_sessionId_idempotencyKey_key" ON "DraftPick"("sessionId", "idempotencyKey");

CREATE TABLE "UserDraftTeamSelection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserDraftTeamSelection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserDraftTeamSelection_userId_sessionId_key" ON "UserDraftTeamSelection"("userId", "sessionId");
CREATE INDEX "UserDraftTeamSelection_sessionId_teamId_idx" ON "UserDraftTeamSelection"("sessionId", "teamId");
ALTER TABLE "UserDraftTeamSelection" ADD CONSTRAINT "UserDraftTeamSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDraftTeamSelection" ADD CONSTRAINT "UserDraftTeamSelection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DraftSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDraftTeamSelection" ADD CONSTRAINT "UserDraftTeamSelection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "DraftTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
