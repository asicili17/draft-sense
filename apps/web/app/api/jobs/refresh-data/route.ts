import { NextRequest, NextResponse } from "next/server";
export function GET(request: NextRequest) { if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Unauthorized", { status: 401 }); return NextResponse.json({ data: { accepted: true } }, { status: 202 }); }
