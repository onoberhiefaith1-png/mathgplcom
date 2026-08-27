/**
 * A Live teaching room's recurring schedule.
 *
 * Each teaching day carries its own time — Monday 4:00 PM and Thursday 6:00 PM
 * live side by side. The schedule is purely informational: it tells the public
 * when the teacher normally teaches and never opens, closes or expires a room.
 */

/** Day index ("0" = Sunday … "6" = Saturday) → "HH:MM" in the room's zone. */
export type ScheduleTimes = Record<string, string>;

export type ScheduleEntry = { day: number; time: string | null };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Monday first, Sunday last — how teachers read a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const dayName = (day: number): string => DAY_NAMES[((day % 7) + 7) % 7];

const isClock = (v: unknown): v is string => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);

/** Tolerant parse of the `schedule_times` jsonb column. */
export const parseScheduleTimes = (value: unknown): ScheduleTimes => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ScheduleTimes = {};
  for (const [key, time] of Object.entries(value as Record<string, unknown>)) {
    const day = Number(key);
    if (Number.isInteger(day) && day >= 0 && day <= 6 && isClock(time)) out[String(day)] = time;
  }
  return out;
};

/**
 * Rooms created before per-day times share one time across their days; treat
 * that legacy value as the time of every selected day.
 */
export const hydrateScheduleTimes = (
  rawTimes: unknown,
  days: number[],
  legacyTime: string | null,
): ScheduleTimes => {
  const parsed = parseScheduleTimes(rawTimes);
  if (Object.keys(parsed).length > 0) return parsed;
  if (!isClock(legacyTime)) return {};
  return Object.fromEntries(days.map((d) => [String(d), legacyTime]));
};

/** The room's teaching days in week order, each with its own time. */
export const scheduleEntries = (days: number[], times: ScheduleTimes): ScheduleEntry[] =>
  WEEK_ORDER.filter((d) => days.includes(d)).map((day) => ({
    day,
    time: times[String(day)] ?? null,
  }));

/** "17:30" → "5:30 PM" */
export const formatClockTime = (time: string | null): string => {
  if (!time) return "";
  const [h, m] = time.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

/** "Monday 4:00 PM · Thursday 6:00 PM" — one line for cards and headers. */
export const formatSchedule = (days: number[], times: ScheduleTimes): string => {
  const entries = scheduleEntries(days, times);
  if (entries.length === 0) return "Schedule not set";
  return entries
    .map(({ day, time }) => (time ? `${dayName(day)} ${formatClockTime(time)}` : dayName(day)))
    .join(" · ");
};

/**
 * The next time this room's lesson normally begins, honouring each day's own
 * time. Informational only — it never expires and never blocks anything.
 */
export const nextOccurrence = (
  days: number[],
  times: ScheduleTimes,
  now: Date = new Date(),
): { at: Date; day: number; time: string } | null => {
  let best: { at: Date; day: number; time: string } | null = null;
  for (const { day, time } of scheduleEntries(days, times)) {
    if (!time) continue;
    const [h, m] = time.split(":").map((n) => Number(n));
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    for (let ahead = 0; ahead <= 7; ahead++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + ahead);
      candidate.setHours(h, m, 0, 0);
      if (candidate.getDay() !== day || candidate.getTime() <= now.getTime()) continue;
      if (!best || candidate.getTime() < best.at.getTime()) best = { at: candidate, day, time };
      break;
    }
  }
  return best;
};

/** "Thursday · 6:00 PM" for the next lesson, or "" when unscheduled. */
export const formatNextLesson = (
  days: number[],
  times: ScheduleTimes,
  now: Date = new Date(),
): string => {
  const next = nextOccurrence(days, times, now);
  return next ? `${dayName(next.day)} · ${formatClockTime(next.time)}` : "";
};
