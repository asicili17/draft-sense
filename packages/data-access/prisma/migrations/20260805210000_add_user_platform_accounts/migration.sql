CREATE TABLE "UserPlatformAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPlatformAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPlatformAccount_userId_provider_key" ON "UserPlatformAccount"("userId", "provider");
CREATE UNIQUE INDEX "UserPlatformAccount_provider_externalUserId_key" ON "UserPlatformAccount"("provider", "externalUserId");
CREATE INDEX "UserPlatformAccount_provider_externalUserId_idx" ON "UserPlatformAccount"("provider", "externalUserId");

ALTER TABLE "UserPlatformAccount"
  ADD CONSTRAINT "UserPlatformAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
