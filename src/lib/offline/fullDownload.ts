/**
 * The one complete download of the offline Academia app. Content is only
 * replaced when the whole download finished, so a dropped connection never
 * leaves a half-updated copy. Nothing updates unless this runs (first open or
 * the student's Update button).
 */
import { getKv, saveCatalogue, setKv, type Catalogue, type PackSchool } from "@/lib/offline/academiaStore";
import { prepareOffline, workerReady } from "@/lib/offline/prepareOffline";

export type DownloadStage = "app" | "content" | "media" | "done";

/** Overall percentage: app 0-20, content 20-35, media 35-100. */
export function downloadPercent(stage: DownloadStage, done = 0, total = 0): number {
  if (stage === "done") return 100;
  if (stage === "app") return 10;
  if (stage === "content") return 25;
  const frac = total > 0 ? Math.min(1, done / total) : 1;
  return Math.round(35 + frac * 64);
}

export const READY_KEY = "readyAt.v2";
export const getReadyAt = () => getKv<string>(READY_KEY);

export type DownloadResult = { ok: true; catalogue: Catalogue; at: string } | { ok: false; reason: "offline" | "failed" };

export async function downloadEverything(addedIds: string[], onPercent: (p: number) => void): Promise<DownloadResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
  try {
    onPercent(downloadPercent("app"));
    // The worker activates only after the whole app (Game, Smartboard, fonts,
    // surfaces, rewards) is precached, so waiting for it means the app is saved.
    await workerReady(60_000);
    onPercent(downloadPercent("content"));
    const r = await fetch("/api/public/academia-pack", { cache: "no-store" });
    if (!r.ok) return { ok: false, reason: "failed" };
    const catalogue = (await r.json()) as Catalogue;
    const picked: PackSchool[] = catalogue.schools.filter((s) => addedIds.includes(s.id));
    // Nothing added yet: save every public school so backgrounds work offline.
    const mine = picked.length ? picked : catalogue.schools;
    await prepareOffline(mine, (x) => {
      if (x.state === "working") onPercent(downloadPercent("media", x.done, x.total));
    });
    const at = new Date().toISOString();
    await saveCatalogue(catalogue);
    await setKv(READY_KEY, at);
    onPercent(100);
    return { ok: true, catalogue, at };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
