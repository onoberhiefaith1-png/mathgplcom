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
  starts_at: string | null;
  duration_minutes: number;
  time_zone: string;
  visibility: SessionVisibility;
  status: SessionStatus;
  session_code: string;
  broadcasts: BroadcastEntry[];
  /** Teacher switch: ask link-holding audience members for a display name. */
  ask_participant_name: boolean;
  created_at: string;
  updated_at: string;

};

/**
 * Column list for every session read. `session_code` is deliberately excluded:
 * the join code is private to the owner and is fetched through
 * `my_session_code`, so public/audience reads can never leak it.
 */
export const SESSION_COLUMNS =
  "id, owner_id, class_id, notebook_id, title, description, starts_at, duration_minutes, time_zone, visibility, status, created_at, updated_at, broadcasts, ask_participant_name";

/** Owner-only read of a session's private join code. */
export const fetchSessionCode = async (sessionId: string): Promise<string> => {
  const { data } = await supabase.rpc("my_session_code", { _session_id: sessionId });
  return typeof data === "string" ? data : "";
};

export const fetchSessionCodes = async (ids: string[]): Promise<Record<string, string>> => {
  const pairs = await Promise.all(ids.map(async (id) => [id, await fetchSessionCode(id)] as const));
  return Object.fromEntries(pairs);
};

/** Rows come back with `broadcasts` as raw jsonb — normalise on read. */
export const hydrateSession = (row: Record<string, unknown>): LiveSession => ({
  ...(row as unknown as LiveSession),
  broadcasts: parseBroadcasts(row.broadcasts),
  ask_participant_name: Boolean(row.ask_participant_name),
  session_code: typeof row.session_code === "string" ? row.session_code : "",
});



/** Derived, schedule-driven state shown to teacher and participants. */
export type ScheduleState = "unscheduled" | "scheduled" | "starting-soon" | "live" | "ended";

const STARTING_SOON_MS = 15 * 60 * 1000;

export const scheduleStateOf = (
  session: Pick<LiveSession, "starts_at" | "duration_minutes">,
  now: number = Date.now(),
): ScheduleState => {
  if (!session.starts_at) return "unscheduled";
  const start = new Date(session.starts_at).getTime();
  if (Number.isNaN(start)) return "unscheduled";
  const end = start + Math.max(1, session.duration_minutes) * 60_000;
  if (now >= end) return "ended";
  if (now >= start) return "live";
  if (start - now <= STARTING_SOON_MS) return "starting-soon";
  return "scheduled";
};

export const scheduleLabel: Record<ScheduleState, string> = {
  unscheduled: "Not scheduled",
  scheduled: "Scheduled",
  "starting-soon": "Starting soon",
  live: "Live now",
  ended: "Ended",
};

export const scheduleTone: Record<ScheduleState, string> = {
  unscheduled: "border-border bg-muted/40 text-muted-foreground",
  scheduled: "border-cyan-300/40 bg-cyan-400/10 text-cyan-200",
  "starting-soon": "border-amber-300/40 bg-amber-400/10 text-amber-200",
  live: "border-emerald-300/50 bg-emerald-400/15 text-emerald-200",
  ended: "border-border bg-muted/40 text-muted-foreground",
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
  startsAt?: string | null;
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

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        owner_id: input.ownerId,
        class_id: classId,
        notebook_id: input.notebookId || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        starts_at: input.startsAt || null,
        duration_minutes: input.durationMinutes,
        time_zone: input.timeZone,
        visibility: input.visibility,
        status: "published",
        session_code: generateSessionCode(),
        broadcasts: normalizeBroadcasts(input.broadcasts ?? []) as unknown as never,
        ask_participant_name: Boolean(input.askParticipantName),

      })
      .select(SESSION_COLUMNS)
      .single();
    if (!error && data) {
      const row = hydrateSession(data as Record<string, unknown>);
      return { ...row, session_code: await fetchSessionCode(row.id) };
    }

    lastError = error;
    if (error && (error as { code?: string }).code !== "23505") break;
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



export const deleteSession = async (session: Pick<LiveSession, "class_id">) => {
  // Deleting the backing class cascades to the session row and all its data.
  return supabase.from("classes").delete().eq("id", session.class_id);
};
