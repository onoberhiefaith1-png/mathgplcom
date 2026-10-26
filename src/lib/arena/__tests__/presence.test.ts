import { describe, it, expect } from "vitest";
import {
  ACTIVE_WINDOW_MS,
  BEAT_EVERY_MS,
  agoText,
  countPresence,
  latestSeen,
  presenceOf,
  sortParticipants,
} from "@/lib/arena/presence";

const NOW = Date.parse("2026-10-26T10:00:00Z");

describe("Arena presence", () => {
  it("beats come faster than the active window so one miss does not flicker", () => {
    expect(BEAT_EVERY_MS * 2).toBeLessThan(ACTIVE_WINDOW_MS + 1);
  });
  it("is active when seen within the window and inactive after it", () => {
    expect(presenceOf(NOW - 10_000, NOW)).toBe("active");
    expect(presenceOf(NOW - ACTIVE_WINDOW_MS, NOW)).toBe("active");
    expect(presenceOf(NOW - ACTIVE_WINDOW_MS - 1, NOW)).toBe("inactive");
  });
  it("never seen (or unreadable) is inactive", () => {
    expect(presenceOf(null, NOW)).toBe("inactive");
    expect(presenceOf(undefined, NOW)).toBe("inactive");
    expect(presenceOf(Number.NaN, NOW)).toBe("inactive");
  });
  it("a device clock slightly ahead still reads active", () => {
    expect(presenceOf(NOW + 3000, NOW)).toBe("active");
  });
  it("latestSeen takes the newest valid time across the arena beat and the guest heartbeat", () => {
    expect(
      latestSeen(
        "2026-10-26T09:59:00Z",
        "2026-10-26T09:59:50Z",
        null,
        "garbage",
      ),
    ).toBe(Date.parse("2026-10-26T09:59:50Z"));
    expect(latestSeen(null, undefined, "nope")).toBeNull();
  });
  it("counts active and inactive", () => {
    expect(
      countPresence([
        { presence: "active" },
        { presence: "inactive" },
        { presence: "active" },
      ]),
    ).toEqual({ joined: 3, active: 2, inactive: 1 });
    expect(countPresence([])).toEqual({ joined: 0, active: 0, inactive: 0 });
  });
  it("sorts active first, then most recently seen, then name", () => {
    const rows = [
      { name: "Zed", presence: "inactive" as const, lastSeenAt: NOW - 500_000 },
      { name: "Bea", presence: "active" as const, lastSeenAt: NOW - 20_000 },
      { name: "Al", presence: "active" as const, lastSeenAt: NOW - 2_000 },
      { name: "Cy", presence: "inactive" as const, lastSeenAt: NOW - 90_000 },
    ];
    expect(sortParticipants(rows).map((r) => r.name)).toEqual([
      "Al",
      "Bea",
      "Cy",
      "Zed",
    ]);
  });
  it("describes how long ago", () => {
    expect(agoText(NOW - 1000, NOW)).toBe("just now");
    expect(agoText(NOW - 20_000, NOW)).toBe("20s ago");
    expect(agoText(NOW - 180_000, NOW)).toBe("3 min ago");
    expect(agoText(null, NOW)).toBe("never");
  });
});
