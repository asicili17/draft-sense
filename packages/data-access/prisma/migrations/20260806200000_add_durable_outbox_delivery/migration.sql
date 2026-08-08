ALTER TABLE "OutboxEvent"
  ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "leasedUntil" TIMESTAMP(3),
  ADD COLUMN "leaseToken" TEXT,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "queueMessageId" TEXT,
  ADD COLUMN "deadLetteredAt" TIMESTAMP(3);

CREATE INDEX "OutboxEvent_processedAt_availableAt_createdAt_idx"
  ON "OutboxEvent"("processedAt", "availableAt", "createdAt");
CREATE INDEX "OutboxEvent_leasedUntil_idx" ON "OutboxEvent"("leasedUntil");
CREATE INDEX "OutboxEvent_deadLetteredAt_idx" ON "OutboxEvent"("deadLetteredAt");

ALTER TABLE "DraftSession"
  ADD COLUMN "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
