// Preload games + their asset URLs so the student sees a fully-formed scene.

import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "./urls";
import { normalizeCanvas, type CanvasElement, type GameRow } from "./types";
import { loadClassGameBoards, type GameBoard } from "./gameQuestions";

type Cached = { game: GameRow; boards: GameBoard[]; urls: Record<string, string> };
const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<Cached | null>>();

const cacheKey = (classId: string, gameId: string) => `${classId}::${gameId}`;

const pathsFor = (el: CanvasElement): string[] => {
  const out: string[] = [];
  if (el.source !== "url" && el.storagePath) out.push(el.storagePath);
  const p = el.progress;
  if (p) {
    if (p.effectSource !== "url" && p.effectStoragePath) out.push(p.effectStoragePath);
    for (const slot of Object.values(p.slotEffects ?? {})) {
      if (slot?.effectSource !== "url" && slot?.effectStoragePath) out.push(slot.effectStoragePath);
    }
  }
  return out;
};

const allPaths = (game: GameRow): string[] => {
  const canvas = normalizeCanvas(game.canvas);
  const out = new Set<string>();
  for (const s of canvas.scenes) for (const el of s.elements) for (const p of pathsFor(el)) out.add(p);
  return [...out];
};

const allUrlSources = (game: GameRow): string[] => {
  const canvas = normalizeCanvas(game.canvas);
  const out: string[] = [];
  for (const s of canvas.scenes) {
    for (const el of s.elements) {
      if (el.source === "url" && el.storagePath) out.push(el.storagePath);
    }
  }
  return out;
};

const warm = (url: string, kind: "image" | "video"): Promise<void> =>
  new Promise((resolve) => {
    try {
      if (kind === "image") {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
        return;
      }
      void fetch(url, { mode: "cors", credentials: "omit" }).then(() => resolve()).catch(() => resolve());
    } catch {
      resolve();
    }
  });

export async function prefetchGame(classId: string, gameId: string): Promise<Cached | null> {
  const key = cacheKey(classId, gameId);
  const hit = cache.get(key);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running) return running;

  const p = (async (): Promise<Cached | null> => {
    const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    if (!g) return null;
    const game = g as unknown as GameRow;
    const paths = allPaths(game);
    const [urls, boards] = await Promise.all([
      getSignedUrls(paths),
      loadClassGameBoards(gameId, classId).catch(() => [] as GameBoard[]),
    ]);
    const missing = paths.filter((p) => !urls[p]);
    if (missing.length > 0) {
      console.warn("[prefetchGame] Missing signed URLs — check storage RLS:", missing);
    }
    const canvas = normalizeCanvas(game.canvas);
    for (const s of canvas.scenes) {
      for (const el of s.elements) {
        const paths = pathsFor(el);
        for (const path of paths) {
          const url = urls[path];
          if (!url) continue;
          void warm(url, el.mediaType);
        }
      }
    }
    for (const url of allUrlSources(game)) void warm(url, "image");
    const entry: Cached = { game, boards, urls };
    cache.set(key, entry);
    return entry;
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

export function getPrefetched(classId: string, gameId: string): Cached | undefined {
  return cache.get(cacheKey(classId, gameId));
}

export function updatePrefetchedGame(classId: string, gameId: string, game: GameRow): void {
  const key = cacheKey(classId, gameId);
  const hit = cache.get(key);
  if (hit) cache.set(key, { ...hit, game });
}

type ReadyJob = { url: string; kind: "image" | "video" };

const collectReadyJobs = (
  game: GameRow,
  urls: Record<string, string>,
): ReadyJob[] => {
  const canvas = normalizeCanvas(game.canvas);
  const scene = canvas.scenes.find((s) => s.id === canvas.activeSceneId) ?? canvas.scenes[0];
  if (!scene) return [];
  const jobs: ReadyJob[] = [];
  const seen = new Set<string>();
  const push = (url: string | undefined, kind: "image" | "video") => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    jobs.push({ url, kind });
  };
  const resolvePath = (source: string | undefined, path: string | undefined | null) => {
    if (!path) return undefined;
    return source === "url" ? path : urls[path];
  };
  for (const el of scene.elements) {
    // Main element source
    push(resolvePath(el.source, el.storagePath), el.mediaType);
    // Reward / progress-bar effects
    const p = el.progress;
    if (p) {
      push(resolvePath(p.effectSource, p.effectStoragePath), "image");
      for (const slot of Object.values(p.slotEffects ?? {})) {
        if (!slot) continue;
        push(resolvePath(slot.effectSource, slot.effectStoragePath), "image");
      }
    }
  }
  return jobs;
};

export async function waitForSceneReady(
  game: GameRow,
  urls: Record<string, string>,
  timeoutMs = 6000,
): Promise<void> {
  const jobs = collectReadyJobs(game, urls);
  const tasks = jobs.map(({ url, kind }) => {
    if (kind === "image") {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => (img.decode ? img.decode().then(() => resolve(), () => resolve()) : resolve());
        img.onerror = () => resolve();
        img.src = url;
      });
    }
    return new Promise<void>((resolve) => {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      const done = () => resolve();
      v.oncanplaythrough = done;
      v.onloadeddata = done;
      v.onerror = done;
      v.src = url;
      v.load();
    });
  });

  await Promise.race([
    Promise.all(tasks).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
