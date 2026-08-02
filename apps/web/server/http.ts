import { DraftDomainError } from "@draft-sense/draft-engine";
import { NextResponse } from "next/server";
export function apiError(error: unknown) {
  if (error instanceof DraftDomainError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.code === "VERSION_CONFLICT" ? 409 : 422 },
    );
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  return NextResponse.json({ error: { code: "REQUEST_FAILED", message } }, { status: 400 });
}
