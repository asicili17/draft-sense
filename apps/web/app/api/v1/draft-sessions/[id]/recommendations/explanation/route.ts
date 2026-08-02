import { getDraftSession } from "@draft-sense/data-access";
import { NextResponse } from "next/server";
import { apiError } from "../../../../../../../server/http";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) { try { const session = await getDraftSession((await context.params).id); if (!session) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Draft session not found." } }, { status: 404 }); return NextResponse.json({ data: { source: "template", explanation: "This recommendation is based on projected value, positional scarcity, your open roster slots, and average draft position. The ranking itself is deterministic; this explanation cannot change it." } }); } catch (error) { return apiError(error); } }
