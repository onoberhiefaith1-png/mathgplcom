/** Timer Arena — browser helpers. All calls go to /api/public/arena/<code>. */
import type { EntryConfig, MyPosition } from "@/lib/arena/ranking";
import {
  ArenaApiError, dropOutbox, enqueueOutbox, readOutbox, recordCompletion, recordStart,
  type SubmitEvent,
} from "@/lib/arena/submit";

const base = (code: string) => `/api/public/arena/${encodeURIComponent(code)}`;

export type ArenaInfo = { shareId: string; title: string; status: string; guestCode: string; entry: EntryConfig; avatars: string[]; photosEnabled?: boolean };
export type ArenaTopEntry = { place: number; name: string; avatar: string | null; photo?: string | null; ms: number };
export type ArenaColumn = {
  number: number; activityId: string; assessmentId: string; title: string; rankedCount: number;
  /** false when the question card has its timer switched off, so nobody can be timed on it. */
  timerEnabled?: boolean;
  top: ArenaTopEntry[];
};
export type ArenaPerson = {
  id: string; name: string; avatar: string | null; photo: string | null;
  presence: "active" | "inactive"; lastSeenAt: number | null;
  /** Question number being worked on right now, when known. */
  working: number | null; ranked: number; joinedAt: number | null;
};
export type ArenaBoard = {
  shareId: string; title: string; status: string; sessionTitle: string;
  crumbs: Record<string, string | null>; joined: number; online: number; rankedParticipants: number; columns: ArenaColumn[];
  /** Server clock when this snapshot was built (ISO) — orders out-of-order replies. */
  generatedAt?: string;
  active?: number; inactive?: number; activeWindowMs?: number;
  participants?: ArenaPerson[]; participantsTotal?: number;
};
export type ArenaMe = {
  joined: number; myBestMs: number | null; overallBestMs: number | null; position: MyPosition;
  name?: string | null; avatar?: string | null; photo?: string | null;
};

const getJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ArenaApiError((body as { error?: string }).error ?? "failed", r.status);
  return body as T;
};
const post = async (code: string, body: Record<string, unknown>) => {
  const r = await fetch(base(code), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true, cache: "no-store",
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new ArenaApiError((json as { error?: string }).error ?? "failed", r.status);
  return json as Record<string, unknown>;
};

export const fetchArenaInfo = (code: string) => getJson<ArenaInfo>(`${base(code)}?action=info`);
export const fetchArenaBoard = (code: string) => getJson<ArenaBoard>(`${base(code)}?action=board&_=${Date.now()}`);
export const fetchArenaMe = (code: string, token: string, assessmentId: string) =>
  getJson<ArenaMe>(`${base(code)}?action=me&token=${token}&assessmentId=${assessmentId}&_=${Date.now()}`);
export const joinArena = (code: string, token: string, name: string | null, avatar: string | null, photo?: string | null) =>
  post(code, { action: "join", token, name, avatar, ...(photo ? { photo } : {}) });
/** Same-origin URL of a stored picture (the only picture source the screens render). */
export { arenaPhotoPath as arenaPhotoUrl } from "@/lib/arena/photo";

/* ── Which Arena group is this device playing in, for a given Session link? ── */
const KEY = (guestCode: string) => `mathgpl.arena.for.${guestCode}`;
export const setActiveArena = (guestCode: string, arenaCode: string) => {
  try { localStorage.setItem(KEY(guestCode), arenaCode); } catch { /* private mode */ }
};
export const activeArena = (guestCode: string | null | undefined): string | null => {
  if (!guestCode || typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY(guestCode)); } catch { return null; }
};

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const emit = (e: SubmitEvent) => {
  try { window.dispatchEvent(new CustomEvent("arena:submit", { detail: e })); } catch { /* no window */ }
  // Back-compat: the panel's "result" event, fired once a final answer exists.
  if (e.state === "saved") {
    try { window.dispatchEvent(new CustomEvent("arena:result", { detail: { assessmentId: e.assessmentId, ok: true, counted: e.counted, newBest: e.newBest, ms: e.ms } })); } catch { /* no window */ }
  }
};

/** Never blocks the board; retried quietly so one dropped request can't lose the attempt's start. */
export const arenaStart = (guestCode: string, token: string, assessmentId: string, questionId: string) => {
  const code = activeArena(guestCode);
  if (!code) return;
  void recordStart({ post, sleep }, { code, token, assessmentId, questionId });
};

// One send per question at a time, so a flush can't double-send what is already in flight.
const inFlight = new Set<string>();
const sendOne = async (item: { code: string; token: string; assessmentId: string; questionId: string; elapsedMs: number }) => {
  const key = `${item.code}:${item.token}:${item.assessmentId}`;
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  try {
    const result = await recordCompletion({ post, sleep, emit }, item);
    if (result.state === "saved" || result.retryable === false) dropOutbox(localStorage, item);
    return result;
  } finally { inFlight.delete(key); }
};

/** Finished a question: send it, retry on trouble, and keep it queued until the server answers. */
export const arenaComplete = (guestCode: string, token: string, assessmentId: string, questionId: string, elapsedMs: number) => {
  const code = activeArena(guestCode);
  if (!code) return;
  const item = { code, token, assessmentId, questionId, elapsedMs };
  try { enqueueOutbox(localStorage, item); } catch { /* private mode */ }
  void sendOne(item);
};

let flushing = false;
/** Re-send anything that never got an answer (after a refresh, a reconnect or a Retry tap). */
export const flushArenaOutbox = async (assessmentId?: string) => {
  if (flushing || typeof window === "undefined") return;
  flushing = true;
  try {
    for (const item of readOutbox(localStorage)) {
      if (assessmentId && item.assessmentId !== assessmentId) continue;
      await sendOne(item);
    }
  } finally { flushing = false; }
};

/** "I'm here" — keeps the student's dot green on the Live Report. */
export const arenaBeat = (guestCode: string, token: string, assessmentId?: string | null) => {
  const code = activeArena(guestCode);
  if (!code) return;
  void post(code, { action: "beat", token, ...(assessmentId ? { assessmentId } : {}) }).catch(() => {});
};
