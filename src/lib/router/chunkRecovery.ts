const CHUNK_RELOAD_KEY = "mathgpl:chunk-reload";
const CHUNK_RETRY_PARAM = "__chunk_retry";
const RECOVERY_WINDOW_MS = 60_000;

type ChunkRecoveryAttempt = {
  path: string;
  attemptedAt: number;
};

function readRecoveryAttempt(): ChunkRecoveryAttempt | undefined {
  try {
    const value = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!value) return undefined;
    const parsed = JSON.parse(value) as Partial<ChunkRecoveryAttempt>;
    if (typeof parsed.path !== "string" || typeof parsed.attemptedAt !== "number") return undefined;
    return { path: parsed.path, attemptedAt: parsed.attemptedAt };
  } catch {
    return undefined;
  }
}

export function recoverFromStaleChunk(error: unknown) {
  if (typeof window === "undefined") return false;

  if (!isRecoverableModuleError(error)) {
    return false;
  }

  const url = new URL(window.location.href);
  const previousAttempt = readRecoveryAttempt();
  if (
    previousAttempt?.path === url.pathname &&
    Date.now() - previousAttempt.attemptedAt < RECOVERY_WINDOW_MS
  ) {
    return false;
  }

  window.sessionStorage.setItem(
    CHUNK_RELOAD_KEY,
    JSON.stringify({ path: url.pathname, attemptedAt: Date.now() } satisfies ChunkRecoveryAttempt),
  );

  // A normal reload can be served the same cached document, which still points
  // at the deleted hashed asset. A unique query forces a fresh route document.
  url.searchParams.set(CHUNK_RETRY_PARAM, String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

export function isRecoverableModuleError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Failed to load module script|Outdated Optimize Dep|504.*(?:\.vite\/deps|optimized dependenc)|(?:\.vite\/deps|optimized dependenc).*504/i.test(
    message,
  );
}

export function clearStaleChunkRecovery() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);

  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHUNK_RETRY_PARAM)) return;
  url.searchParams.delete(CHUNK_RETRY_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}