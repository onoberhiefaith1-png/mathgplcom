/**
 * Saves everything the offline Academia app needs onto the device, in two
 * stages so the student is never kept waiting:
 *  1. Essentials (pictures, sounds, start page) — small, parallel, blocks Ready.
 *  2. Videos — large, downloaded in the background after Ready.
 * The worker (vite.config.ts) serves media marked with `_aof=1` cache-first.
 */
import type { PackSchool } from "@/lib/offline/academiaStore";
import { BUILT_IN_REWARD_SOUNDS } from "@/lib/slate/builtInRewardSounds";
import { DEFAULT_GAME_BACKGROUND_URL } from "@/components/imagine/defaultBackground";
import fallbackCharacter from "@/assets/game-fallback-character.png";

export const OFFLINE_MEDIA_CACHE = "academia-media";
const PAGES_CACHE = "academia-pages";
/** Very large teaching videos stay online-only so a phone isn't filled up. */
const MAX_MEDIA_BYTES = 300 * 1024 * 1024;
export const PARALLEL = 6;
export const ESSENTIAL_TIMEOUT_MS = 10_000;
const VIDEO_TIMEOUT_MS = 10 * 60_000;

const isYoutube = (u: string) => /youtu\.?be/i.test(u);
export const isVideoUrl = (u: string) => /\.(mp4|mov|webm|m4v|m3u8)(\?|&|$)/i.test(decodeURIComponent(u.split("#")[0]));

/** The address the app uses for a saved file, so the worker can serve it offline. */
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

/** Every file (not YouTube) in the given schools, without repeats. */
export function mediaToSave(schools: PackSchool[]): string[] {
  const out = new Set<string>();
  out.add(offlineMediaUrl(fallbackCharacter));
  out.add(offlineMediaUrl("/__l5e/assets-v1/768ead1c-0498-4d8a-be85-e7d622d189d6/gold_star.png"));
  out.add(offlineMediaUrl("/__l5e/assets-v1/f9769783-01eb-451f-ad61-d2a24f593275/gold_coin_crown.png"));
  if (DEFAULT_GAME_BACKGROUND_URL) out.add(offlineMediaUrl(DEFAULT_GAME_BACKGROUND_URL));
  for (const list of Object.values(BUILT_IN_REWARD_SOUNDS)) for (const snd of list) out.add(snd.path);
  for (const s of schools)
    for (const c of s.classes) for (const sub of c.subjects) for (const t of sub.topics) for (const st of t.subtopics)
      for (const se of st.sessions) {
        if (se.videoUrl && !isYoutube(se.videoUrl)) out.add(offlineMediaUrl(se.videoUrl));
        for (const a of se.activities) {
          if (a.videoUrl && !isYoutube(a.videoUrl)) out.add(offlineMediaUrl(a.videoUrl));
          if (a.practiceVideoUrl && !isYoutube(a.practiceVideoUrl)) out.add(offlineMediaUrl(a.practiceVideoUrl));
          if (a.playVideoUrl && !isYoutube(a.playVideoUrl)) out.add(offlineMediaUrl(a.playVideoUrl));
          if (a.adventure) {
            const canvas = a.adventure.canvas;
            const collect = (value: unknown) => {
              if (!value || typeof value !== "object") return;
              for (const [key, child] of Object.entries(value)) {
                if ((key === "path" || key === "storagePath" || key === "effectStoragePath") && typeof child === "string" && /^(https?:\/\/|\/api\/public\/academia-media\?)/.test(child) && !isYoutube(child)) out.add(offlineMediaUrl(child));
                else if (child && typeof child === "object") collect(child);
              }
            };
            collect(canvas);
            if (canvas.video?.path && !isYoutube(canvas.video.path)) out.add(offlineMediaUrl(canvas.video.path));
            for (const clip of canvas.narrations ?? []) if (clip.path) out.add(offlineMediaUrl(clip.path));
            if (a.adventure.audio.music?.path) out.add(offlineMediaUrl(a.adventure.audio.music.path));
            for (const url of Object.values(a.adventure.assetUrls)) if (url && !isYoutube(url)) out.add(offlineMediaUrl(url));
          }
          if (a.imageUrl) out.add(offlineMediaUrl(a.imageUrl));
          for (const url of Object.values(a.game?.assetUrls ?? {}))
            if (url && !isYoutube(url)) out.add(offlineMediaUrl(url));
        }
      }
  return [...out];
}

/** Splits media into the small must-have files and the big background videos. */
export function splitMedia(urls: string[]): { essential: string[]; videos: string[] } {
  const essential: string[] = [];
  const videos: string[] = [];
  for (const u of urls) (isVideoUrl(u) ? videos : essential).push(u);
  return { essential, videos };
}

/** Runs `task` over items with at most `limit` running at once. */
export async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
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

/** Saves one file; true when it is (now) on the device or deliberately skipped as too big. */
async function saveOne(media: Cache, url: string, timeoutMs: number): Promise<boolean> {
  if (await media.match(url)) return true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const size = Number(res.headers.get("content-length") ?? 0);
      if (size > MAX_MEDIA_BYTES) { void res.body?.cancel(); return true; }
      if (!res.ok || res.status === 206) { void res.body?.cancel(); throw new Error("bad"); }
      await media.put(url, res);
      return true;
    } catch { /* one quick retry */ } finally { clearTimeout(timer); }
  }
  return false;
}

/** Stage 1: essentials only. Fast and parallel; decides Ready. */
export async function prepareOffline(
  schools: PackSchool[],
  onProgress: (r: OfflineReadiness) => void,
): Promise<OfflineReadiness> {
  if (typeof caches === "undefined") {
    const r: OfflineReadiness = { state: "unsupported" };
    onProgress(r);
    return r;
  }
  void navigator.storage?.persist?.().catch(() => undefined);
  const pagePromise = caches.open(PAGES_CACHE).then((c) => c.add("/academia-app")).catch(() => undefined);

  const { essential } = splitMedia(mediaToSave(schools));
  const media = await caches.open(OFFLINE_MEDIA_CACHE);
  const saved: string[] = [];
  let skipped = 0;
  let done = 0;
  onProgress({ state: "working", done, total: essential.length });
  await runPool(essential, PARALLEL, async (url) => {
    if (await saveOne(media, url, ESSENTIAL_TIMEOUT_MS)) saved.push(url); else skipped++;
    done++;
    onProgress({ state: "working", done, total: essential.length });
  });
  await pagePromise;
  const page = await caches.match("/academia-app").catch(() => undefined);
  if (!page) skipped++;
  const r: OfflineReadiness = { state: "ready", saved, skipped };
  onProgress(r);
  return r;
}

/** Stage 2: videos in the background. Never blocks Ready; safe to call repeatedly. */
let videoRun: Promise<void> | null = null;
export function downloadVideosInBackground(
  schools: PackSchool[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (videoRun) return videoRun;
  videoRun = (async () => {
    if (typeof caches === "undefined") return;
    const { videos } = splitMedia(mediaToSave(schools));
    const media = await caches.open(OFFLINE_MEDIA_CACHE);
    let done = 0;
    onProgress?.(0, videos.length);
    await runPool(videos, 2, async (url) => {
      await saveOne(media, url, VIDEO_TIMEOUT_MS);
      onProgress?.(++done, videos.length);
    });
  })().finally(() => { videoRun = null; });
  return videoRun;
}
