import { supabase } from "@/integrations/supabase/client";
import { BroadcastEntry, normalizeBroadcasts, parseBroadcasts } from "@/lib/live/broadcast";

export type SessionVisibility = "private" | "public";
export type SessionStatus = "draft" | "published" | "live" | "ended";

export type LiveSession = {
  id: string;
  owner_id: string;
  class_id: string;
  notebook_id: string | null;
  title: string;
  description: string | null;
  /** Legacy one-time start. Kept for old rows only; never drives state. */
  starts_at: string | null;
  duration_minutes: number;
  time_zone: string;
  visibility: SessionVisibility;
  status: SessionStatus;
  session_code: string;
  broadcasts: BroadcastEntry[];
  /** Teacher switch: ask link-holding audience members for a display name. */
  ask_participant_name: boolean;
  /** Teacher switch: enter instantly (true) or wait for approval (false). */
  allow_free_entry: boolean;
  /** Recurring teaching days, 0 = Sunday … 6 = Saturday. Informational. */
  schedule_days: number[];
  /** Recurring teaching time as "HH:MM" in `time_zone`. Informational. */
  schedule_time: string | null;
  /** True only while the teacher is actually teaching. Never time-derived. */
  is_live: boolean;
  live_started_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Column list for every session read. `session_code` is deliberately excluded:
 * the join code is private to the owner and is fetched through
 * `my_session_code`, so public/audience reads can never leak it.
 */
export const SESSION_COLUMNS: string =
  "id, owner_id, class_id, notebook_id, title, description, starts_at, duration_minutes, time_zone, visibility, status, created_at, updated_at, broadcasts, ask_participant_name";

/** Recurring-room columns, read separately so a row still loads without them. */
const ROOM_COLUMNS = ", schedule_days, schedule_time, is_live, live_started_at";

let roomColumnsAvailable: boolean | null = null;

/**
 * Read sessions with the recurring-room columns when the database has them and
 * transparently fall back to the base columns when it does not.
 */
export const querySessions = async <T>(
  build: (columns: string) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T | null> => {
  if (roomColumnsAvailable !== false) {
    const res = await build(SESSION_COLUMNS + ROOM_COLUMNS);
    if (!res.error) {
      roomColumnsAvailable = true;
      return res.data;
    }
    roomColumnsAvailable = false;
  }
  const res = await build(SESSION_COLUMNS);
  return res.data;
};

/**
 * The free-entry switch is read on its own so a session still loads on
 * deployments where the column has not landed yet; absent means free entry.
 */
export const fetchAllowFreeEntry = async (sessionId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("sessions")
    .select("allow_free_entry" as never)
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return true;
  const value = (data as unknown as Record<string, unknown>).allow_free_entry;
  return value === undefined || value === null ? true : Boolean(value);
};

/** Owner-only read of a session's private join code. */
export const fetchSessionCode = async (sessionId: string): Promise<string> => {
  const { data } = await supabase.rpc("my_session_code", { _session_id: sessionId });
  return typeof data === "string" ? data : "";
};

export const fetchSessionCodes = async (ids: string[]): Promise<Record<string, string>> => {
  const pairs = await Promise.all(ids.map(async (id) => [id, await fetchSessionCode(id)] as const));
  return Object.fromEntries(pairs);
};

const toDays = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];

/** Rows come back with `broadcasts` as raw jsonb — normalise on read. */
export const hydrateSession = (row: Record<string, unknown>): LiveSession => ({
  ...(row as unknown as LiveSession),
  broadcasts: parseBroadcasts(row.broadcasts),
  ask_participant_name: Boolean(row.ask_participant_name),
  allow_free_entry: row.allow_free_entry === undefined ? true : Boolean(row.allow_free_entry),
  session_code: typeof row.session_code === "string" ? row.session_code : "",
  schedule_days: toDays(row.schedule_days),
  schedule_time: typeof row.schedule_time === "string" ? row.schedule_time : null,
  is_live: Boolean(row.is_live),
  live_started_at: typeof row.live_started_at === "string" ? row.live_started_at : null,
});

/* ------------------------------------------------------------------ *
 * Persistent room state
 *
 * A Live Session is a teaching room that exists until the teacher deletes it.
 * The clock never ends it: LIVE comes from the teacher's own switch, and the
 * recurring schedule is only ever displayed.
 * ------------------------------------------------------------------ */

export type RoomState = "live" | "scheduled" | "open";

export type RoomSchedule = Pick<LiveSession, "schedule_days" | "schedule_time" | "is_live">;

export const roomStateOf = (session: RoomSchedule): RoomState => {
  if (session.is_live) return "live";
  return session.schedule_days.length > 0 && session.schedule_time ? "scheduled" : "open";
};

export const roomLabel: Record<RoomState, string> = {
  live: "Live now",
  scheduled: "Teaching room",
  open: "Teaching room",
};

export const roomTone: Record<RoomState, string> = {
  live: "border-emerald-300/50 bg-emerald-400/15 text-emerald-200",
  scheduled: "border-cyan-300/40 bg-cyan-400/10 text-cyan-200",
  open: "border-border bg-muted/40 text-muted-foreground",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const dayName = (day: number): string => DAY_NAMES[((day % 7) + 7) % 7];

/** "17:30" → "5:30 PM" */
export const formatClockTime = (time: string | null): string => {
  if (!time) return "";
  const [h, m] = time.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

/** "Every Tuesday · 5:00 PM" / "Mondays & Thursdays · 4:00 PM" */
export const formatRecurring = (days: number[], time: string | null): string => {
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  if (sorted.length === 0 || !time) return "Schedule not set";
  const clock = formatClockTime(time);
  if (sorted.length === 7) return `Every day · ${clock}`;
  if (sorted.length === 1) return `Every ${dayName(sorted[0])} · ${clock}`;
  const names = sorted.map((d) => `${dayName(d)}s`);
  const last = names.pop() as string;
  return `${names.join(", ")} & ${last} · ${clock}`;
};

/**
 * The next time this room's lesson normally begins. Purely informational — it
 * never expires and never blocks anything.
 */
export const nextOccurrence = (
  days: number[],
  time: string | null,
  now: Date = new Date(),
): Date | null => {
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  if (sorted.length === 0 || !time) return null;
  const [h, m] = time.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  for (let ahead = 0; ahead <= 7; ahead++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + ahead);
    candidate.setHours(h, m, 0, 0);
    if (sorted.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
};

/** "Tuesday · 5:00 PM" for the next lesson, or "" when unscheduled. */
export const formatNextLesson = (session: RoomSchedule, now: Date = new Date()): string => {
  const next = nextOccurrence(session.schedule_days, session.schedule_time, now);
  if (!next) return "";
  return `${dayName(next.getDay())} · ${formatClockTime(session.schedule_time)}`;
};

/** "2 Hours 35 Minutes 18 Seconds" — verbose countdown for the hero area. */
export const formatCountdownLong = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? "Day" : "Days"}`);
  if (days || hours) parts.push(`${hours} ${hours === 1 ? "Hour" : "Hours"}`);
  parts.push(`${minutes} ${minutes === 1 ? "Minute" : "Minutes"}`);
  parts.push(`${seconds} ${seconds === 1 ? "Second" : "Seconds"}`);
  return parts.join(" ");
};

/** "01:12:34" — compact clock countdown. */
export const formatCountdownClock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
};

export const formatStartsAt = (iso: string | null, timeZone?: string): string => {
  if (!iso) return "No date set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No date set";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const generateSessionCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

const generateClassCode = () => `LIV-${Math.floor(1000 + Math.random() * 9000)}`;

export type CreateSessionInput = {
  title: string;
  description?: string | null;
  notebookId?: string | null;
  /** Recurring teaching days, 0 = Sunday … 6 = Saturday. */
  scheduleDays: number[];
  /** Recurring teaching time as "HH:MM". */
  scheduleTime: string | null;
  durationMinutes: number;
  timeZone: string;
  visibility: SessionVisibility;
  ownerId: string;
  broadcasts?: BroadcastEntry[];
  /** Ask link-holding audience members for a display name before they take part. */
  askParticipantName?: boolean;
};

/**
 * A Session is backed by a hidden class row so every existing class-scoped
 * feature (Smartboard, Assignments, Adventure, Assessment, Gallery, Reports)
 * keeps working untouched.
 */
export const createSession = async (input: CreateSessionInput): Promise<LiveSession> => {
  let classId: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5 && !classId; attempt++) {
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: input.title.trim(),
        description: input.description?.trim() || null,
        class_code: generateClassCode(),
        owner_id: input.ownerId,
        // MathGPL Life backing row — never listed as a Teaching Hub class.
        workspace: "live",
      })
      .select("id")
      .single();
    if (!error && data) {
      classId = data.id;
      break;
    }
    lastError = error;
    if (error && (error as { code?: string }).code !== "23505") break;
  }
  if (!classId) {
    throw new Error(String((lastError as { message?: string })?.message ?? "Could not create session"));
  }

  const base = {
    owner_id: input.ownerId,
    class_id: classId,
    notebook_id: input.notebookId || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    duration_minutes: input.durationMinutes,
    time_zone: input.timeZone,
    visibility: input.visibility,
    status: "published",
    session_code: generateSessionCode(),
    broadcasts: normalizeBroadcasts(input.broadcasts ?? []) as unknown as never,
    ask_participant_name: Boolean(input.askParticipantName),
  };
  const schedule = {
    schedule_days: input.scheduleDays,
    schedule_time: input.scheduleTime,
    is_live: false,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    // Only the recurring schedule is written; a room has no expiry date.
    const payload = { ...base, session_code: generateSessionCode(), ...(roomColumnsAvailable === false ? {} : schedule) };
    const { data, error } = await supabase
      .from("sessions")
      .insert(payload as never)
      .select(SESSION_COLUMNS)
      .single();
    if (!error && data) {
      const row = hydrateSession({ ...(data as unknown as Record<string, unknown>), ...schedule });
      return { ...row, session_code: await fetchSessionCode(row.id) };
    }

    lastError = error;
    const code = (error as { code?: string })?.code;
    // Schedule columns not present yet — retry without them.
    if (code === "42703" || code === "PGRST204") {
      roomColumnsAvailable = false;
      continue;
    }
    if (code !== "23505") break;
  }

  // Session row failed — remove the orphan class so nothing dangles.
  await supabase.from("classes").delete().eq("id", classId);
  throw new Error(String((lastError as { message?: string })?.message ?? "Could not create session"));
};

/** Teacher edits the broadcast platforms after the session exists. */
export const updateSessionBroadcasts = async (sessionId: string, broadcasts: BroadcastEntry[]) =>
  supabase
    .from("sessions")
    .update({ broadcasts: normalizeBroadcasts(broadcasts) as unknown as never })
    .eq("id", sessionId);

/** Teacher edits the recurring teaching schedule of a persistent room. */
export const updateSessionSchedule = async (
  sessionId: string,
  scheduleDays: number[],
  scheduleTime: string | null,
) =>
  supabase
    .from("sessions")
    .update({ schedule_days: scheduleDays, schedule_time: scheduleTime } as never)
    .eq("id", sessionId);

/**
 * LIVE is an explicit teacher action, never a consequence of the clock. The
 * room itself stays open either way.
 */
export const setLiveState = async (sessionId: string, isLive: boolean) =>
  supabase
    .from("sessions")
    .update({
      is_live: isLive,
      live_started_at: isLive ? new Date().toISOString() : null,
    } as never)
    .eq("id", sessionId);

export const deleteSession = async (session: Pick<LiveSession, "class_id">) => {
  // Deleting the backing class cascades to the session row and all its data.
  return supabase.from("classes").delete().eq("id", session.class_id);
};
