/**
 * Keeps the installed Academia app in step with Academia. The pack route
 * already hashes the whole public pack into `version`; the app asks the route
 * for just that hash (`?versionOnly=1`), compares it with the saved copy and
 * downloads again only when they differ. Pure helpers, no browser needed.
 */
import { ACADEMIA_PACK_SCHEMA } from "@/lib/offline/academiaPack";

export const VERSION_URL = "/api/public/academia-pack?versionOnly=1";
export const VERSION_TIMEOUT_MS = 10_000;

export type SavedPack = { schema?: number; version?: string } | null | undefined;
export type RemoteVersion = { schema?: number; version: string };

/** Asks the server for the current pack version. Throws when it cannot be read. */
export async function fetchRemoteVersion(fetchImpl: typeof fetch = fetch, timeoutMs = VERSION_TIMEOUT_MS): Promise<RemoteVersion> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const r = await fetchImpl(VERSION_URL, { cache: "no-store", signal: ctrl?.signal });
    if (!r.ok) throw new Error(`version check failed (${r.status})`);
    const body = (await r.json()) as Partial<RemoteVersion>;
    if (typeof body.version !== "string" || !body.version) throw new Error("version check returned no version");
    return { schema: body.schema, version: body.version };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * True when the saved copy must be downloaded again: its format is older than
 * this app's, or the server's version differs. No saved copy is not "stale":
 * the first download has its own path.
 */
export function packIsStale(saved: SavedPack, remote: Pick<RemoteVersion, "version">): boolean {
  if (!saved) return false;
  if ((saved.schema ?? 0) < ACADEMIA_PACK_SCHEMA) return true;
  return saved.version !== remote.version;
}

/** unchanged: same version · updated: downloaded a newer copy · failed: check or download failed · skipped: nothing saved yet */
export type SyncOutcome = "unchanged" | "updated" | "failed" | "skipped";

export async function syncIfStale(deps: {
  saved: () => Promise<SavedPack>;
  remote: () => Promise<RemoteVersion>;
  /** Runs the existing download path; resolves true when the new copy is saved. */
  download: () => Promise<boolean>;
}): Promise<SyncOutcome> {
  const saved = await deps.saved();
  if (!saved) return "skipped";
  try {
    if (!packIsStale(saved, await deps.remote())) return "unchanged";
    return (await deps.download()) ? "updated" : "failed";
  } catch {
    return "failed";
  }
}

export function updateFailedMessage(savedAt: string | null | undefined, format: (iso: string) => string = (iso) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })): string {
  return savedAt
    ? `Couldn't update, showing saved copy from ${format(savedAt)}`
    : "Nothing is downloaded yet. Connect to the internet and try again.";
}
