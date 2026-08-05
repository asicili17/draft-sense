-- Repairs the incomplete initial baseline found in an existing Preview database.
-- Every statement is safe when the object already exists.

CREATE TABLE IF NOT EXISTS "RecommendationSnapshot" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SimulationRun" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "trials" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OutboxEvent" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecommendationSnapshot_sessionId_createdAt_idx"
  ON "RecommendationSnapshot"("sessionId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "RecommendationSnapshot_sessionId_sessionVersion_algorithmVe_key"
  ON "RecommendationSnapshot"("sessionId", "sessionVersion", "algorithmVersion");
CREATE UNIQUE INDEX IF NOT EXISTS "SimulationRun_sessionId_sessionVersion_seed_key"
  ON "SimulationRun"("sessionId", "sessionVersion", "seed");
CREATE INDEX IF NOT EXISTS "OutboxEvent_processedAt_createdAt_idx"
  ON "OutboxEvent"("processedAt", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "League_ownerId_name_key" ON "League"("ownerId", "name");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecommendationSnapshot_sessionId_fkey'
  ) THEN
    ALTER TABLE "RecommendationSnapshot"
      ADD CONSTRAINT "RecommendationSnapshot_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "DraftSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SimulationRun_sessionId_fkey'
  ) THEN
    ALTER TABLE "SimulationRun"
      ADD CONSTRAINT "SimulationRun_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "DraftSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OutboxEvent_sessionId_fkey'
  ) THEN
    ALTER TABLE "OutboxEvent"
      ADD CONSTRAINT "OutboxEvent_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "DraftSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
