import type { DraftRealtimeEvent } from "@draft-sense/events";
import { NextResponse } from "next/server";
import { requireSessionAccess } from "../../../../../../server/auth";
import { apiError } from "../../../../../../server/http";
import { changedSessionEvents, readSessionEventState } from "../../../../../../server/realtime/session-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const pollIntervalMs = 2_000;
const heartbeatIntervalMs = 15_000;

function encodeEvent(encoder: TextEncoder, event: DraftRealtimeEvent) {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const { session } = await requireSessionAccess(id);
    if (!session)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );
    const initialState = await readSessionEventState(id);
    if (!initialState)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft session not found." } },
        { status: 404 },
      );

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let previous = initialState;
        let lastHeartbeat = Date.now();
        controller.enqueue(
          encodeEvent(encoder, { type: "connected", sessionId: id, sessionVersion: initialState.sessionVersion }),
        );
        try {
          while (!request.signal.aborted) {
            await sleep(pollIntervalMs);
            if (request.signal.aborted) break;
            const next = await readSessionEventState(id);
            if (!next) break;
            for (const event of changedSessionEvents(id, previous, next))
              controller.enqueue(encodeEvent(encoder, event));
            previous = next;
            if (Date.now() - lastHeartbeat >= heartbeatIntervalMs) {
              controller.enqueue(encoder.encode(": keepalive\n\n"));
              lastHeartbeat = Date.now();
            }
          }
        } catch {
          // EventSource reconnects automatically; avoid exposing internal failures to the client.
        } finally {
          controller.close();
        }
      },
    });
    return new NextResponse(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
