/**
 * Saves everything the offline Academia app needs onto the device: the app
 * page itself and the non-YouTube videos of the schools a learner added.
 * The worker (vite.config.ts) serves media marked with `_aof=1` cache-first.
 */
import type { PackSchool } from "@/lib/offline/academiaStore";

export const OFFLINE_MEDIA_CACHE = "academia-media";
const PAGES_CACHE = "academia-pages";
/** Very large teaching videos stay online-only so a phone isn't filled up. */
const MAX_MEDIA_BYTES = 300 * 1024 * 1024;

const isYoutube = (u: string) => /youtu\.?be/i.test(u);

/** The address the app uses for a saved video, so the worker can serve it offline. */
export function offlineMediaUrl(url: string): string {
  if (isYoutube(url)) return url;
  try {
    const u = new URL(url, typeof window === "undefined" ? "https://mathgpl.com" : window.location.origin);
    u.searchParams.set("_aof", "1");
    return u.toString();
  } catch {
    return url;
  }
}

/** Every video file (not YouTube) in the given schools, without repeats. */
export function mediaToSave(schools: PackSchool[]): string[] {
  const out = new Set<string>();
  for (const s of schools)
    for (const c of s.classes) for (const sub of c.subjects) for (const t of sub.topics) for (const st of t.subtopics)
      for (const se of st.sessions) {
        if (se.videoUrl && !isYoutube(se.videoUrl)) out.add(offlineMediaUrl(se.videoUrl));
        for (const a of se.activities) {
          if (a.videoUrl && !isYoutube(a.videoUrl)) out.add(offlineMediaUrl(a.videoUrl));
          if (a.practiceVideoUrl && !isYoutube(a.practiceVideoUrl)) out.add(offlineMediaUrl(a.practiceVideoUrl));
          if (a.playVideoUrl && !isYoutube(a.playVideoUrl)) out.add(offlineMediaUrl(a.playVideoUrl));
          if (a.imageUrl) out.add(offlineMediaUrl(a.imageUrl));
          for (const url of Object.values(a.game?.assetUrls ?? {}))
            if (url && !isYoutube(url)) out.add(offlineMediaUrl(url));
        }
      }
  return [...out];
}

export type OfflineReadiness =
  | { state: "unsupported" }
  | { state: "working"; done: number; total: number }
  | { state: "ready"; saved: string[]; skipped: number };

/** True once the offline worker is installed and controls this page. */
export async function workerReady(timeoutMs = 8000): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (navigator.serviceWorker.controller) return true;
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
  ]);
  return Boolean(reg && (navigator.serviceWorker.controller || reg.active));
}

export async function prepareOffline(
  schools: PackSchool[],
  onProgress: (r: OfflineReadiness) => void,
): Promise<OfflineReadiness> {
  if (typeof caches === "undefined" || !(await workerReady())) {
    const r: OfflineReadiness = { state: "unsupported" };
    onProgress(r);
    return r;
  }
  // The app page, so the installed icon opens with no data at all.
  try { await (await caches.open(PAGES_CACHE)).add("/academia-app"); } catch { /* offline right now */ }

  const urls = mediaToSave(schools);
  const media = await caches.open(OFFLINE_MEDIA_CACHE);
  const saved: string[] = [];
  let skipped = 0;
  let done = 0;
  onProgress({ state: "working", done, total: urls.length });
  for (const url of urls) {
    try {
      if (await media.match(url)) saved.push(url);
      else {
        const head = await fetch(url, { method: "HEAD" }).catch(() => null);
        const size = Number(head?.headers.get("content-length") ?? 0);
        if (size > MAX_MEDIA_BYTES) skipped++;
        else {
          const res = await fetch(url);
          if (res.ok) { await media.put(url, res); saved.push(url); } else skipped++;
        }
      }
    } catch { skipped++; }
    done++;
    onProgress({ state: "working", done, total: urls.length });
  }
  const r: OfflineReadiness = { state: "ready", saved, skipped };
  onProgress(r);
  return r;
}
