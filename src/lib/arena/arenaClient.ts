/** Timer Arena — browser helpers. All calls go to /api/public/arena/<code>. */
import type { EntryConfig, MyPosition } from "@/lib/arena/ranking";

const base = (code: string) => `/api/public/arena/${encodeURIComponent(code)}`;

export type ArenaInfo = { shareId: string; title: string; status: string; guestCode: string; entry: EntryConfig; avatars: string[] };
export type ArenaColumn = {
  number: number; activityId: string; assessmentId: string; title: string; rankedCount: number;
  top: { place: number; name: string; avatar: string | null; ms: number }[];
};
export type ArenaBoard = {
  shareId: string; title: string; status: string; sessionTitle: string;
  crumbs: Record<string, string | null>; joined: number; online: number; rankedParticipants: number; columns: ArenaColumn[];
};
export type ArenaMe = { joined: number; myBestMs: number | null; overallBestMs: number | null; position: MyPosition };

const getJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error ?? "failed");
  return body as T;
};
const post = async (code: string, body: Record<string, unknown>) => {
  const r = await fetch(base(code), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json as { error?: string }).error ?? "failed");
  return json as Record<string, unknown>;
};

export const fetchArenaInfo = (code: string) => getJson<ArenaInfo>(`${base(code)}?action=info`);
export const fetchArenaBoard = (code: string) => getJson<ArenaBoard>(`${base(code)}?action=board`);
export const fetchArenaMe = (code: string, token: string, assessmentId: string) =>
  getJson<ArenaMe>(`${base(code)}?action=me&token=${token}&assessmentId=${assessmentId}`);
export const joinArena = (code: string, token: string, name: string | null, avatar: string | null) =>
  post(code, { action: "join", token, name, avatar });

/* ── Which Arena group is this device playing in, for a given Session link? ── */
const KEY = (guestCode: string) => `mathgpl.arena.for.${guestCode}`;
export const setActiveArena = (guestCode: string, arenaCode: string) => {
  try { localStorage.setItem(KEY(guestCode), arenaCode); } catch { /* private mode */ }
};
export const activeArena = (guestCode: string | null | undefined): string | null => {
  if (!guestCode || typeof window === "undefined") return null;
  try { return localStorage.getItem(KEY(guestCode)); } catch { return null; }
};

/** Fire-and-forget: never blocks or slows the board. */
export const arenaStart = (guestCode: string, token: string, assessmentId: string, questionId: string) => {
  const code = activeArena(guestCode);
  if (!code) return;
  void post(code, { action: "start", token, assessmentId, questionId }).catch(() => {});
};

export const arenaComplete = (guestCode: string, token: string, assessmentId: string, questionId: string, elapsedMs: number) => {
  const code = activeArena(guestCode);
  if (!code) return;
  let tries = 0;
  const send = () => {
    tries++;
    void post(code, { action: "complete", token, assessmentId, questionId, elapsedMs })
      .then((r) => {
        if (r["pending"] && tries < 4) window.setTimeout(send, 1200 * tries);
        else window.dispatchEvent(new CustomEvent("arena:result", { detail: { assessmentId, ...r } }));
      })
      .catch(() => {});
  };
  send();
};
