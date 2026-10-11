/**
 * The one "Get ready" download of the offline Academia app (first open and the
 * Update button). Time-boxed: it always finishes within HARD_DEADLINE_MS.
 * Ready needs only the content list saved and read back from the device;
 * pictures that miss the deadline are skipped (the castle covers them) and
 * videos keep saving in the background.
 */
import { getCatalogue, getKv, saveCatalogue, setKv, type Catalogue, type PackSchool } from "@/lib/offline/academiaStore";
import { downloadVideosInBackground, prepareOffline } from "@/lib/offline/prepareOffline";

export const READY_KEY = "readyAt.v5";
export const HARD_DEADLINE_MS = 45_000;
export const getReadyAt = () => getKv<string>(READY_KEY);

/** Progress: content 0-30, pictures 30-99, done 100. */
export function readyPercent(stage: "content" | "media" | "done", done = 0, total = 0): number {
  if (stage === "done") return 100;
  if (stage === "content") return 15;
  const frac = total > 0 ? Math.min(1, done / total) : 1;
  return Math.round(30 + frac * 69);
}

/** Resolves with the task's value, or `fallback` once `ms` has passed. */
export function withDeadline<T>(task: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    task.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}

/** Ready only when what was saved can be read back from the device. */
export function verifiedCatalogue(saved: Catalogue | undefined, expected: Catalogue): boolean {
  return Boolean(saved && Array.isArray(saved.schools) && saved.schools.length === expected.schools.length);
}

export type ReadyResult = { ok: true; catalogue: Catalogue; at: string; skipped: number } | { ok: false; reason: "offline" | "failed" };

export async function getReady(
  addedIds: string[],
  onPercent: (p: number) => void,
  onVideos?: (done: number, total: number) => void,
): Promise<ReadyResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
  const started = Date.now();
  const left = () => Math.max(1000, HARD_DEADLINE_MS - (Date.now() - started));
  try {
    onPercent(readyPercent("content"));
    const r = await withDeadline(fetch("/api/public/academia-pack", { cache: "no-store" }), 20_000, null);
    if (!r || !r.ok) return { ok: false, reason: "failed" };
    const catalogue = (await r.json()) as Catalogue;
    const mine: PackSchool[] = catalogue.schools.filter((s) => addedIds.includes(s.id));
    // Pictures: whatever arrives before the deadline; the rest is skipped.
    let skipped = 0;
    const media = await withDeadline(
      prepareOffline(mine, (x) => { if (x.state === "working") onPercent(readyPercent("media", x.done, x.total)); }),
      left(),
      null,
    );
    if (!media || media.state !== "ready") skipped = -1; else skipped = media.skipped;
    await saveCatalogue(catalogue);
    if (!verifiedCatalogue(await getCatalogue().catch(() => undefined), catalogue)) return { ok: false, reason: "failed" };
    const at = new Date().toISOString();
    await setKv(READY_KEY, at);
    onPercent(100);
    void downloadVideosInBackground(mine, onVideos);
    return { ok: true, catalogue, at, skipped };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
