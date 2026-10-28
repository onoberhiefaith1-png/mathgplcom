import { describe, expect, it } from "vitest";

import { entryDecision, isPresent } from "@/lib/live/audience";

describe("live audience entry", () => {
  it("lets anyone in when free entry is on", () => {
    expect(entryDecision({ allowFreeEntry: true, status: null })).toBe("enter");
    expect(entryDecision({ allowFreeEntry: true, status: "waiting" })).toBe("enter");
  });

  it("waits for the teacher when free entry is off", () => {
    expect(entryDecision({ allowFreeEntry: false, status: null })).toBe("waiting");
    expect(entryDecision({ allowFreeEntry: false, status: "waiting" })).toBe("waiting");
  });

  it("lets an approved visitor in even with free entry off", () => {
    expect(entryDecision({ allowFreeEntry: false, status: "approved" })).toBe("enter");
  });

  it("keeps a removed visitor out either way", () => {
    expect(entryDecision({ allowFreeEntry: true, status: "removed" })).toBe("removed");
    expect(entryDecision({ allowFreeEntry: false, status: "removed" })).toBe("removed");
  });

  it("counts recent heartbeats as present", () => {
    const now = Date.now();
    expect(isPresent({ last_seen_at: new Date(now - 5_000).toISOString() }, now)).toBe(true);
    expect(isPresent({ last_seen_at: new Date(now - 600_000).toISOString() }, now)).toBe(false);
  });
});
