import { DraftDomainError } from "@draft-sense/draft-engine";
import { NextResponse } from "next/server";
import { AuthorizationError } from "./auth";
export function apiError(error: unknown) {
  if (error instanceof AuthorizationError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  if (error instanceof DraftDomainError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.code === "VERSION_CONFLICT" ? 409 : 422 },
    );
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  return NextResponse.json({ error: { code: "REQUEST_FAILED", message } }, { status: 400 });
}
