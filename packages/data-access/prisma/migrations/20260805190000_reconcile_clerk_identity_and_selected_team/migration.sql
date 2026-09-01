-- Repairs databases where the first Clerk migration was recorded but its schema
-- changes were not present. Every statement is safe when the change already exists.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkUserId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkUserId_key" ON "User"("clerkUserId");

ALTER TABLE "DraftPick" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "DraftPick_sessionId_idempotencyKey_key"
  ON "DraftPick"("sessionId", "idempotencyKey");

CREATE TABLE IF NOT EXISTS "UserDraftTeamSelection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserDraftTeamSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDraftTeamSelection_userId_sessionId_key"
  ON "UserDraftTeamSelection"("userId", "sessionId");
CREATE INDEX IF NOT EXISTS "UserDraftTeamSelection_sessionId_teamId_idx"
  ON "UserDraftTeamSelection"("sessionId", "teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserDraftTeamSelection_userId_fkey'
  ) THEN
    ALTER TABLE "UserDraftTeamSelection"
      ADD CONSTRAINT "UserDraftTeamSelection_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserDraftTeamSelection_sessionId_fkey'
  ) THEN
    ALTER TABLE "UserDraftTeamSelection"
      ADD CONSTRAINT "UserDraftTeamSelection_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "DraftSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserDraftTeamSelection_teamId_fkey'
  ) THEN
    ALTER TABLE "UserDraftTeamSelection"
      ADD CONSTRAINT "UserDraftTeamSelection_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "DraftTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
