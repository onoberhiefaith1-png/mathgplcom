// Staged preload for the Academia Adventure player. Pure, so it can be tested
// without a browser: the first things the student needs are fetched first and
// Start is offered as soon as those are in (or a short cap passes); everything
// else keeps downloading quietly in the background.

export type PreloadJob = { key: string; kind: "music" | "narration" | "sound"; at?: number; run: () => Promise<unknown> };

/** Reject after `ms`. The underlying work keeps going (we just stop waiting). */
export function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then((v) => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

/** Run `fn`, and once more if it throws or returns the failure marker. */
export async function retryOnce<T>(fn: () => Promise<T>, failed: (v: T) => boolean = () => false): Promise<T> {
  try {
    const v = await fn();
    if (!failed(v)) return v;
  } catch { /* retry below */ }
  return fn();
}

/**
 * Split jobs into what must be ready before Start and what can wait.
 * Essential = the teacher's music (it starts on the tap) plus the first
 * `firstClips` narrator clips by video time. Everything else is lazy, in video order.
 */
export function planPreload(jobs: PreloadJob[], firstClips = 2): { essential: PreloadJob[]; lazy: PreloadJob[] } {
  const byTime = (a: PreloadJob, b: PreloadJob) => (a.at ?? Infinity) - (b.at ?? Infinity);
  const clips = jobs.filter((j) => j.kind === "narration").sort(byTime);
  const essential = [...jobs.filter((j) => j.kind === "music"), ...clips.slice(0, Math.max(0, firstClips))];
  const lazy = [...jobs.filter((j) => j.kind === "sound"), ...clips.slice(Math.max(0, firstClips))];
  return { essential, lazy };
}

/** Run `items` with at most `limit` in flight. Never rejects. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>, isCancelled: () => boolean = () => false): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !isCancelled()) {
      const item = items[next++]!;
      try { await worker(item); } catch { /* one asset never blocks the rest */ }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, lane));
}

export type PreloadProgress = { done: number; total: number };

/**
 * `ready` resolves when every essential job finished OR `essentialCapMs`
 * passed, whichever is first. `all` resolves when the lazy jobs are done too.
 */
export function runStagedPreload(
  jobs: PreloadJob[],
  opts: { essentialCapMs: number; perJobMs: number; concurrency?: number; firstClips?: number; onProgress?: (p: PreloadProgress) => void; isCancelled?: () => boolean },
): { ready: Promise<void>; all: Promise<void> } {
  const { essential, lazy } = planPreload(jobs, opts.firstClips ?? 2);
  const concurrency = opts.concurrency ?? 3;
  const cancelled = opts.isCancelled ?? (() => false);
  let done = 0;
  const report = (total: number) => opts.onProgress?.({ done, total });
  const worker = (total: number) => async (job: PreloadJob) => {
    await withTimeout(retryOnce(job.run), opts.perJobMs, null);
    done += 1;
    report(total);
  };
  report(essential.length);
  const essentialRun = runPool(essential, concurrency, worker(essential.length), cancelled);
  const ready = withTimeout(essentialRun, opts.essentialCapMs, undefined).then(() => undefined);
  const all = essentialRun.then(() => { done = 0; return runPool(lazy, concurrency, async (job) => { await withTimeout(retryOnce(job.run), opts.perJobMs, null); }, cancelled); });
  return { ready, all };
}

/**
 * Start is offered once the data is loaded, the first assets are in and the
 * video can play through without stopping (`canplaythrough`, readyState >= 3),
 * or `waitedMs` shows it is not going to get there soon (the video keeps
 * buffering behind the tap and play waits for it).
 */
export function canOfferStart(state: { dataReady: boolean; essentialReady: boolean; videoLoaded: boolean; waitedMs: number }, videoCapMs = 15000): boolean {
  return state.dataReady && state.essentialReady && (state.videoLoaded || state.waitedMs >= videoCapMs);
}

/** Run `fn` (retrying once) but give up with a readable error after `ms` per try. */
export function withDeadline<T>(fn: () => Promise<T>, ms: number, what: string): Promise<T> {
  const once = () => new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} is taking too long. Check your connection and try again.`)), ms);
    fn().then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
  return retryOnce(once);
}
