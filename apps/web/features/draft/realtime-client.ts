"use client";

import { createRealtime } from "@upstash/realtime/client";
// Server payloads are validated by the app's version-only contract before use.
// `any` is intentional here: Upstash's generic expects Zod schema objects, while
// this shared app contract is a TypeScript discriminated union.
export const { useRealtime: useDraftRealtime } = createRealtime<any>();
