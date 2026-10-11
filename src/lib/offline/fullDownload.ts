/**
 * The one complete download of the offline Academia app. Content is only
 * replaced when the whole download finished, so a dropped connection never
 * leaves a half-updated copy. Nothing updates unless this runs (first open or
 * the student's Update button).
 */
import { getKv, saveCatalogue, setKv, type Catalogue, type PackSchool } from "@/lib/offline/academiaStore";
import { downloadVideosInBackground, prepareOffline, workerReady } from "@/lib/offline/prepareOffline";

export type DownloadStage = "app" | "content" | "media" | "done";

/** Overall percentage: app 0-20, content 20-35, media 35-100. */
export function downloadPercent(stage: DownloadStage, done = 0, total = 0): number {
  if (stage === "done") return 100;
  if (stage === "app") return 10;
  if (stage === "content") return 25;
  const frac = total > 0 ? Math.min(1, done / total) : 1;
  return Math.round(35 + frac * 64);
}

export const READY_KEY = "readyAt.v4";
export const getReadyAt = () => getKv<string>(READY_KEY);

export type DownloadResult = { ok: true; catalogue: Catalogue; at: string } | { ok: false; reason: "offline" | "failed" };

export async function downloadEverything(addedIds: string[], onPercent: (p: number) => void): Promise<DownloadResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
  try {
    onPercent(downloadPercent("app"));
    // App files and school content download at the same time.
    const [appOk, r] = await Promise.all([
      workerReady(30_000),
      fetch("/api/public/academia-pack", { cache: "no-store" }),
    ]);
    if (!appOk || !r.ok) return { ok: false, reason: "failed" };
    onPercent(downloadPercent("content"));
    const catalogue = (await r.json()) as Catalogue;
    // Only the student's added schools; with none added, just the app basics.
    const mine: PackSchool[] = catalogue.schools.filter((s) => addedIds.includes(s.id));
    const res = await prepareOffline(mine, (x) => {
      if (x.state === "working") onPercent(downloadPercent("media", x.done, x.total));
    });
    // Ready depends on essentials only; videos never block it.
    if (res.state !== "ready" || res.skipped > 0) return { ok: false, reason: "failed" };
    const at = new Date().toISOString();
    await saveCatalogue(catalogue);
    await setKv(READY_KEY, at);
    onPercent(100);
    void downloadVideosInBackground(mine);
    return { ok: true, catalogue, at };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
