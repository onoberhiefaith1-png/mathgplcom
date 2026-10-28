import { describe, expect, it } from "vitest";
import { formatSchedule, hydrateScheduleTimes, nextOccurrence } from "../schedule";
import { roomStateOf } from "../sessions";

describe("per-day teaching times", () => {
  const days = [1, 4];
  const times = { "1": "16:00", "4": "18:00" };

  it("keeps each day's own time", () => {
    expect(formatSchedule(days, times)).toBe("Monday 4:00 PM · Thursday 6:00 PM");
  });

  it("picks the soonest day/time pair", () => {
    // Monday 2026-01-05, 12:00 → Monday 16:00 comes before Thursday 18:00.
    const now = new Date("2026-01-05T12:00:00");
    expect(nextOccurrence(days, times, now)?.day).toBe(1);
    // Monday 17:00 → Monday's time has passed, so Thursday is next.
    expect(nextOccurrence(days, times, new Date("2026-01-05T17:00:00"))?.day).toBe(4);
  });

  it("migrates a legacy single time onto every selected day", () => {
    expect(hydrateScheduleTimes(null, days, "15:30")).toEqual({ "1": "15:30", "4": "15:30" });
  });
});

describe("room state is the teacher's switch, never the clock", () => {
  const base = { schedule_days: [1], schedule_times: { "1": "16:00" } };

  it("is live only while the teacher is teaching", () => {
    expect(roomStateOf({ ...base, is_live: true })).toBe("live");
    expect(roomStateOf({ ...base, is_live: false })).toBe("scheduled");
  });

  it("stays a permanent room with no schedule at all", () => {
    expect(roomStateOf({ schedule_days: [], schedule_times: {}, is_live: false })).toBe("open");
  });
});
