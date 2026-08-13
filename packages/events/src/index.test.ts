import { afterEach, describe, expect, it, vi } from "vitest";
import { isDraftSenseJob, QStashQueue } from "./index";

describe("job contracts", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("accepts only versioned DraftSense jobs", () => {
    expect(isDraftSenseJob({ type: "draft.pick.recorded", sessionId: "session", sessionVersion: 4 })).toBe(true);
    expect(isDraftSenseJob({ type: "unknown", sessionId: "session" })).toBe(false);
  });

  it("encodes destination query parameters before publishing", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ messageId: "message" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await new QStashQueue({
      token: "token",
      apiUrl: "https://qstash-us-east-1.upstash.io",
      destination: "https://example.vercel.app/api/jobs/execute?x-vercel-protection-bypass=secret",
    }).publish({ type: "sleeper.refresh.requested", sessionId: "session" });
    expect(fetch).toHaveBeenCalledWith(
      "https://qstash-us-east-1.upstash.io/v2/publish/https%3A%2F%2Fexample.vercel.app%2Fapi%2Fjobs%2Fexecute%3Fx-vercel-protection-bypass%3Dsecret",
      expect.any(Object),
    );
  });
});
