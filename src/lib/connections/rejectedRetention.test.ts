import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETENTION_HOURS,
  RETENTION_CHOICES,
  isRetained,
  rejectedAgo,
  retainedRejections,
  retentionLabel,
  type RejectedRequest,
} from "./rejectedRetention";

const NOW = new Date("2026-08-27T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const row = (id: string, h: number): RejectedRequest =>
  ({
    id,
    relation: "teacher_student",
    status: "rejected",
    direction: "outgoing",
    counterpartUserId: "u",
    counterpartName: "Someone",
    counterpartUsername: "someone",
    counterpartRole: "teacher",
    orgId: null,
    orgName: null,
    message: null,
    createdAt: hoursAgo(h + 1),
    childUserId: null,
    childName: null,
    childConfirmedAt: null,
    counterpartAcceptedAt: null,
    respondedAt: hoursAgo(h),
  }) as RejectedRequest;

describe("rejected request retention", () => {
  it("defaults to 24 hours", () => {
    expect(DEFAULT_RETENTION_HOURS).toBe(24);
    expect(isRetained(hoursAgo(23), 24, NOW)).toBe(true);
    expect(isRetained(hoursAgo(25), 24, NOW)).toBe(false);
  });

  it("measures the window from the rejection, not the request", () => {
    const r = row("a", 30);
    expect(retainedRejections([r], 24, NOW)).toHaveLength(0);
    expect(retainedRejections([r], 72, NOW)).toHaveLength(1);
  });

  it("offers 24 hours, 3, 5 and 7 days", () => {
    expect(RETENTION_CHOICES.map((c) => c.hours)).toEqual([24, 72, 120, 168]);
    expect(retentionLabel(120)).toBe("5 days");
  });

  it("expires 3-, 5- and 7-day windows at their own edges", () => {
    expect(isRetained(hoursAgo(71), 72, NOW)).toBe(true);
    expect(isRetained(hoursAgo(73), 72, NOW)).toBe(false);
    expect(isRetained(hoursAgo(119), 120, NOW)).toBe(true);
    expect(isRetained(hoursAgo(121), 120, NOW)).toBe(false);
    expect(isRetained(hoursAgo(167), 168, NOW)).toBe(true);
    expect(isRetained(hoursAgo(169), 168, NOW)).toBe(false);
  });

  it("keeps a row when the rejection time is unusable rather than hiding it", () => {
    expect(isRetained("not-a-date", 24, NOW)).toBe(true);
  });

  it("falls back to the default when the stored setting is nonsense", () => {
    expect(isRetained(hoursAgo(2), 0, NOW)).toBe(true);
    expect(isRetained(hoursAgo(40), Number.NaN, NOW)).toBe(false);
  });

  it("says how long ago the rejection happened", () => {
    expect(rejectedAgo(hoursAgo(0), NOW)).toBe("just now");
    expect(rejectedAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5 min ago");
    expect(rejectedAgo(hoursAgo(1), NOW)).toBe("1 hour ago");
    expect(rejectedAgo(hoursAgo(50), NOW)).toBe("2 days ago");
  });

  it("keeps the newest rejections and drops only the expired ones", () => {
    const rows = [row("fresh", 1), row("old", 100), row("mid", 40)];
    expect(retainedRejections(rows, 72, NOW).map((r) => r.id)).toEqual(["fresh", "mid"]);
  });
});
