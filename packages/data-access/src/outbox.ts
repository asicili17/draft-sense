import { prisma } from "./prisma";

export type ClaimedOutboxEvent = {
  id: string;
  sessionId: string;
  type: string;
  payload: unknown;
  leaseToken: string;
};

export async function claimOutboxEvents(limit = 25): Promise<ClaimedOutboxEvent[]> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 60_000);
  const candidates = await prisma.outboxEvent.findMany({
    where: { processedAt: null, deadLetteredAt: null, availableAt: { lte: now }, OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const claimed: ClaimedOutboxEvent[] = [];
  for (const event of candidates) {
    const leaseToken = crypto.randomUUID();
    const updated = await prisma.outboxEvent.updateMany({
      where: { id: event.id, processedAt: null, OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }] },
      data: { leasedUntil: leaseUntil, leaseToken, attempts: { increment: 1 } },
    });
    if (updated.count) claimed.push({ ...event, leaseToken });
  }
  return claimed;
}

export async function markOutboxDelivered(id: string, leaseToken: string, queueMessageId: string) {
  await prisma.outboxEvent.updateMany({
    where: { id, leaseToken, processedAt: null },
    data: { processedAt: new Date(), leasedUntil: null, leaseToken: null, queueMessageId, lastError: null },
  });
}

export async function releaseOutboxEvent(id: string, leaseToken: string, error: unknown) {
  const attempts = await prisma.outboxEvent.findUnique({ where: { id }, select: { attempts: true } });
  const message = error instanceof Error ? error.message.slice(0, 1000) : "Publish failed";
  if ((attempts?.attempts ?? 0) >= 8) {
    await prisma.outboxEvent.updateMany({
      where: { id, leaseToken, processedAt: null },
      data: { leasedUntil: null, leaseToken: null, deadLetteredAt: new Date(), lastError: message },
    });
    return;
  }
  const delayMs = Math.min(300_000, 1_000 * 2 ** Math.min(8, attempts?.attempts ?? 0));
  await prisma.outboxEvent.updateMany({
    where: { id, leaseToken, processedAt: null },
    data: { leasedUntil: null, leaseToken: null, availableAt: new Date(Date.now() + delayMs), lastError: message },
  });
}

export async function outboxHealth() {
  const now = new Date();
  const [pending, leased, deadLettered] = await Promise.all([
    prisma.outboxEvent.count({ where: { processedAt: null, deadLetteredAt: null, availableAt: { lte: now } } }),
    prisma.outboxEvent.count({ where: { processedAt: null, leasedUntil: { gt: now } } }),
    prisma.outboxEvent.count({ where: { deadLetteredAt: { not: null } } }),
  ]);
  return { pending, leased, deadLettered };
}
