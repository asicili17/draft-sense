import { describe, expect, it } from "vitest";
import { isDraftSenseJob } from "./index";

describe("job contracts", () => {
  it("accepts only versioned DraftSense jobs", () => {
    expect(isDraftSenseJob({ type: "draft.pick.recorded", sessionId: "session", sessionVersion: 4 })).toBe(true);
    expect(isDraftSenseJob({ type: "unknown", sessionId: "session" })).toBe(false);
  });
});
