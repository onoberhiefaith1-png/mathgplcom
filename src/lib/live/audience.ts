/**
 * MathGPL Live audience access.
 *
 * An audience member is not a MathGPL member. They arrive through an invite
 * link or a Join Code, are identified only by the browser guest token, and are
 * confined to the one session they joined. Nothing here creates a profile, a
 * Student ID or permanent history.
 */
import { supabase } from "@/integrations/supabase/client";
import { guestDisplayName, guestName, guestToken } from "@/lib/live/guest";

export type AudienceStatus = "waiting" | "approved" | "removed";

export type AudienceMember = {
  id: string;
  session_id: string;
  guest_token: string;
  display_name: string | null;
  status: AudienceStatus;
  last_seen_at: string;
  created_at: string;
};

/** What an arriving visitor is allowed to do, given the teacher's switch. */
export type EntryDecision = "enter" | "waiting" | "removed";

export const entryDecision = (input: {
  allowFreeEntry: boolean;
  status: AudienceStatus | null;
}): EntryDecision => {
  if (input.status === "removed") return "removed";
  if (input.status === "approved") return "enter";
  if (input.allowFreeEntry) return "enter";
  return "waiting";
};

/** Live members counted as present in the last two minutes. */
export const PRESENT_WINDOW_MS = 120_000;

export const isPresent = (member: Pick<AudienceMember, "last_seen_at">, now = Date.now()): boolean =>
  now - new Date(member.last_seen_at).getTime() < PRESENT_WINDOW_MS;

const table = () => supabase.from("session_audience" as never) as never as {
  select: (cols: string) => never;
  insert: (row: Record<string, unknown>) => never;
  update: (row: Record<string, unknown>) => never;
};

const AUDIENCE_COLUMNS =
  "id, session_id, guest_token, display_name, status, last_seen_at, created_at";

const rows = (data: unknown): AudienceMember[] =>
  Array.isArray(data) ? (data as AudienceMember[]) : [];

/**
 * Register (or refresh) this browser as audience of a session and return the
 * resulting row. With free entry on the row is created already approved, so the
 * visitor never waits; with it off the teacher approves from the Audience page.
 */
export const joinAudience = async (
  sessionId: string,
  allowFreeEntry: boolean,
): Promise<AudienceMember | null> => {
  const token = guestToken();
  if (!token) return null;
  const name = guestName();

  const existing = await fetchMyMembership(sessionId);
  if (existing) {
    if (existing.status === "removed") return existing;
    const refreshed = await rpcTouch(sessionId, token, name, allowFreeEntry);
    return refreshed ?? existing;
  }

  // Guests may INSERT but not SELECT this table, so the insert must NOT ask for
  // a returned representation — the row is read back through the guarded
  // definer function instead.
  await (table().insert({
    session_id: sessionId,
    guest_token: token,
    display_name: name ?? guestDisplayName(),
    status: allowFreeEntry ? "approved" : "waiting",
  }) as unknown as Promise<{ error: unknown }>);
  return await fetchMyMembership(sessionId);
};

/**
 * A guest never reads or writes the audience table directly: the roll holds
 * other visitors' private guest tokens. Both helpers below pass this browser's
 * own token to a guarded database function, which only ever touches that row.
 */
const rpcTouch = async (
  sessionId: string,
  token: string,
  name: string | null,
  claimFreeEntry: boolean,
): Promise<AudienceMember | null> => {
  const { data } = await (supabase.rpc as never as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown }>)("live_audience_touch", {
    _session: sessionId,
    _token: token,
    _name: name ?? null,
    _claim_free_entry: claimFreeEntry,
  });
  return (data as AudienceMember | null) ?? null;
};

export const fetchMyMembership = async (sessionId: string): Promise<AudienceMember | null> => {
  const token = guestToken();
  if (!token) return null;
  const { data } = await (supabase.rpc as never as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown }>)("live_audience_me", { _session: sessionId, _token: token });
  return (data as AudienceMember | null) ?? null;
};

/** Keeps the teacher's audience list honest about who is still watching. */
export const touchAudience = async (sessionId: string): Promise<void> => {
  const token = guestToken();
  if (!token) return;
  await rpcTouch(sessionId, token, null, false);
};

export const setAudienceName = async (sessionId: string, name: string): Promise<void> => {
  const token = guestToken();
  if (!token) return;
  await rpcTouch(sessionId, token, name.trim().slice(0, 40), false);
};

export const listAudience = async (sessionId: string): Promise<AudienceMember[]> => {
  const query = table().select(AUDIENCE_COLUMNS) as unknown as {
    eq: (c: string, v: string) => {
      order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown }>;
    };
  };
  const { data } = await query.eq("session_id", sessionId).order("created_at", { ascending: true });
  return rows(data);
};

export const setAudienceStatus = async (
  memberId: string,
  status: AudienceStatus,
): Promise<void> => {
  await (table().update({ status, updated_at: new Date().toISOString() }) as unknown as {
    eq: (c: string, v: string) => Promise<unknown>;
  }).eq("id", memberId);
};

/** Teacher switch on the session itself. */
export const setAllowFreeEntry = async (sessionId: string, value: boolean): Promise<void> => {
  await supabase
    .from("sessions")
    .update({ allow_free_entry: value } as never)
    .eq("id", sessionId);
};
