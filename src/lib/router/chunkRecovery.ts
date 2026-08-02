const CHUNK_RELOAD_KEY = "mathgpl:chunk-reload";

export function recoverFromStaleChunk(error: unknown) {
  if (typeof window === "undefined") return false;

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) {
    return false;
  }

  const currentPath = window.location.href;
  if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === currentPath) {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return false;
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, currentPath);
  window.location.reload();
  return true;
}

export function clearStaleChunkRecovery() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}