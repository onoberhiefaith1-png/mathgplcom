/**
 * MathGPL Live — public audience access.
 *
 * Someone who receives an invite link is audience: no account, no permanent
 * profile, no history. Everything they can see comes from session-scoped
 * database functions, so nothing else in the platform is exposed. When a
 * function is not yet available the helpers fail open to "free entry" and empty
 * lists so the page still renders.
 */
import { supabase } from "@/integrations/supabase/client";
import { guestDisplayName, guestToken } from "@/lib/live/guest";
import { BroadcastEntry, parseBroadcasts } from "@/lib/live/broadcast";
import { parseScheduleTimes } from "@/lib/live/schedule";

const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

// `live_entry_requests` and the audience columns arrive with the staged
// migration, so the generated types do not know them yet.
/* eslint-disable @typescript-eslint/no-explicit-any */
const table = (name: string): any => (supabase as any).from(name);

export type EntryStatus = "approved" | "pending" | "declined" | "none" | "unavailable";

export type PublicSession = {
  id: string;
  class_id: string;
  notebook_id: string | null;
  title: string;
  description: string | null;
  starts_at: string | null;
  duration_minutes: number;
  time_zone: string | null;
  status: string;
  ask_participant_name: boolean;
  allow_free_entry: boolean;
  broadcasts: BroadcastEntry[];
  schedule_days: number[];
  schedule_time: string | null;
  schedule_times: Record<string, string>;
  is_live: boolean;
  teacher_name: string | null;
  subject: string | null;
  subtopic: string | null;
  live_started_at: string | null;
};

export type AudienceNote = {
  id: string;
  title: string;
  subject: string | null;
  subtopic: string | null;
  color_index: number | null;
};

export type AudienceActivity = {
  id: string;
  kind: "challenge" | "game_challenge";
  title: string | null;
  status: string | null;
  due_at: string | null;
};

const first = <T,>(data: unknown): T | null =>
  Array.isArray(data) ? ((data[0] as T) ?? null) : ((data as T) ?? null);

export async function fetchPublicSession(sessionId: string): Promise<PublicSession | null> {
  const { data, error } = await rpc("live_public_session", { _session_id: sessionId });
  if (error) return null;
  const row = first<Record<string, unknown>>(data);
  if (!row) return null;
  return {
    ...(row as unknown as PublicSession),
    broadcasts: parseBroadcasts(row.broadcasts),
    schedule_days: Array.isArray(row.schedule_days) ? row.schedule_days.map(Number) : [],
    schedule_time: typeof row.schedule_time === "string" ? row.schedule_time : null,
    schedule_times: parseScheduleTimes(row.schedule_times),
    is_live: Boolean(row.is_live),
    teacher_name: typeof row.teacher_name === "string" ? row.teacher_name : null,
    subject: typeof row.subject === "string" ? row.subject : null,
    subtopic: typeof row.subtopic === "string" ? row.subtopic : null,
    live_started_at: typeof row.live_started_at === "string" ? row.live_started_at : null,
  };
}

/**
 * Is the teacher teaching right now? Polled by the public room page so a
 * visitor sitting on the information page enters the class by itself.
 */
export async function fetchPublicLiveFlag(sessionId: string): Promise<boolean | null> {
  const session = await fetchPublicSession(sessionId);
  return session ? session.is_live : null;
}

/** Private meeting IDs/passwords are returned only after this guest is admitted. */
export async function fetchAdmittedBroadcastCredentials(sessionId: string): Promise<BroadcastEntry[]> {
  const { data, error } = await rpc("live_admitted_broadcast_credentials", {
    _session_id: sessionId,
    _guest_token: guestToken(),
  });
  if (error) return [];
  return parseBroadcasts(data);
}

/** Ask to come in. Free entry admits immediately; otherwise this queues. */
export async function requestEntry(sessionId: string): Promise<EntryStatus> {
  const { data, error } = await rpc("live_request_entry", {
    _session_id: sessionId,
    _guest_token: guestToken(),
    _display_name: guestDisplayName(),
  });
  if (error) return "approved";
  return (data as EntryStatus) ?? "approved";
}

export async function fetchEntryStatus(sessionId: string): Promise<EntryStatus> {
  const { data, error } = await rpc("live_entry_status", {
    _session_id: sessionId,
    _guest_token: guestToken(),
  });
  if (error) return "approved";
  return (data as EntryStatus) ?? "none";
}

export async function fetchAudienceNotes(sessionId: string): Promise<AudienceNote[]> {
  const { data, error } = await rpc("live_public_notes", { _session_id: sessionId });
  if (error) return [];
  return (data as AudienceNote[]) ?? [];
}

export async function fetchAudienceNote(
  sessionId: string,
  notebookId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await rpc("live_public_note", {
    _session_id: sessionId,
    _notebook_id: notebookId,
  });
  if (error) return null;
  return first<Record<string, unknown>>(data);
}

export async function fetchAudienceActivities(sessionId: string): Promise<AudienceActivity[]> {
  const { data, error } = await rpc("live_public_activities", { _session_id: sessionId });
  if (error) return [];
  return (data as AudienceActivity[]) ?? [];
}

export type AudienceBoard = { notebook_id: string | null; state_json: unknown; updated_at: string | null };

export async function fetchAudienceBoard(sessionId: string): Promise<AudienceBoard | null> {
  const { data, error } = await rpc("live_public_smartboard", { _session_id: sessionId });
  if (error) return null;
  return first<AudienceBoard>(data);
}

/* ---------------------------------------------------------------- teacher */

export type EntryRequest = {
  id: string;
  guest_token: string;
  display_name: string | null;
  status: string;
  created_at: string;
};

export async function fetchEntryRequests(sessionId: string): Promise<EntryRequest[]> {
  const { data, error } = await table("live_entry_requests")
    .select("id, guest_token, display_name, status, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as EntryRequest[]) ?? [];
}

export async function decideEntry(id: string, status: "approved" | "declined"): Promise<void> {
  await table("live_entry_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function setFreeEntry(sessionId: string, allow: boolean): Promise<void> {
  await table("sessions")
    .update({ allow_free_entry: allow })
    .eq("id", sessionId);
}

export async function fetchFreeEntry(sessionId: string): Promise<boolean> {
  const { data, error } = await table("sessions")
    .select("allow_free_entry")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) return true;
  return Boolean((data as { allow_free_entry?: boolean } | null)?.allow_free_entry ?? true);
}
