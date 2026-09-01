import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({ data: { status: "ok", service: "draft-sense" } });
}
