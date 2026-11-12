/**
 * "Update app": brings an installed app (Mathemagine or Academia) — or an open
 * tab — onto the latest published version.
 *
 * Why updates did not arrive: the site's pages are never cached (no-cache) and
 * the offline worker (/sw.js, scope "/") already activates new versions at
 * once, but an installed app is a single long-lived page. It only fetches a new
 * page when it is fully closed and reopened, and phones keep installed apps
 * suspended in memory for days, so the app kept running the version it first
 * loaded. This compares the running version with the published one and, when
 * they differ, refreshes the worker, drops the saved pages from older releases,
 * and reloads.
 */
export type UpdateStatus = "update-available" | "up-to-date" | "offline" | "failed";

/** Saved-page cache from the offline worker; pages from an older release point at old files. */
export const STALE_PAGE_CACHES = ["academia-pages"];
/** Set just before the update reload, read once afterwards to say "Updated to the latest version". */
export const UPDATED_FLAG_KEY = "mathgpl.appUpdated";

const ENTRY_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/g;

/** Every entry-style file named in some text (used for what this page loaded). */
export function entryAssets(text: string): string[] {
  return Array.from(new Set(text.match(ENTRY_RE) ?? [])).sort();
}

/**
 * The published version's fingerprint: the app's start script in a page,
 * `<script type="module" src="/assets/index-….js">`. Every page of every
 * version loads it, so it changes exactly when a new version is published.
 */
export function publishedEntry(html: string): string[] {
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/type=["']module["']/i.test(tag)) continue;
    const src = tag.match(/src=["'](\/assets\/index-[A-Za-z0-9_-]+\.js)["']/i);
    if (src) return [src[1]!];
  }
  return [];
}

/** The entry files this running page actually loaded. */
export function loadedEntryAssets(doc: Document = document, perf: Performance | undefined = typeof performance === "undefined" ? undefined : performance): string[] {
  const names: string[] = [];
  try {
    for (const e of perf?.getEntriesByType?.("resource") ?? []) names.push(new URL(e.name, location.href).pathname);
  } catch { /* no timing data */ }
  doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[rel=modulepreload][href]").forEach((el) => {
    const raw = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
    try { names.push(new URL(raw, location.href).pathname); } catch { /* ignore */ }
  });
  return entryAssets(names.join(" "));
}

/** True when the published page uses entry files this page did not load. Unknown (nothing to compare) is not an update. */
export function isNewerBuild(loaded: string[], published: string[]): boolean {
  if (!loaded.length || !published.length) return false;
  return published.some((name) => !loaded.includes(name));
}

/** Asks the offline worker (if any) to check for a newer version. True when one is installing or waiting. */
export async function refreshServiceWorkers(sw: ServiceWorkerContainer | undefined = typeof navigator === "undefined" ? undefined : navigator.serviceWorker): Promise<boolean> {
  if (!sw?.getRegistrations) return false;
  let found = false;
  const regs = await sw.getRegistrations().catch(() => [] as readonly ServiceWorkerRegistration[]);
  for (const reg of regs) {
    await reg.update().catch(() => undefined);
    if (reg.waiting || reg.installing) found = true;
    // The worker already skips waiting on install; this covers an older one that did not.
    reg.waiting?.postMessage({ type: "SKIP_WAITING" });
  }
  return found;
}

export async function checkForAppUpdate(deps: { fetchImpl?: typeof fetch; online?: boolean; loaded?: string[] } = {}): Promise<{ status: UpdateStatus; published: string[] }> {
  const online = deps.online ?? (typeof navigator === "undefined" || navigator.onLine);
  if (!online) return { status: "offline", published: [] };
  try {
    const res = await (deps.fetchImpl ?? fetch)(`/?__update_check=${Date.now()}`, { cache: "no-store", credentials: "same-origin", headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) return { status: "failed", published: [] };
    const published = publishedEntry(await res.text());
    const loaded = deps.loaded ?? loadedEntryAssets();
    return { status: isNewerBuild(loaded, published) ? "update-available" : "up-to-date", published };
  } catch {
    return { status: "failed", published: [] };
  }
}

/** Refreshes the worker, drops saved pages from older releases (never offline lessons or media), then reloads. */
export async function applyAppUpdate(reload: () => void = () => window.location.reload()): Promise<void> {
  await refreshServiceWorkers().catch(() => false);
  try {
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => STALE_PAGE_CACHES.includes(n)).map((n) => caches.delete(n)));
    }
  } catch { /* caches unavailable */ }
  try { window.sessionStorage.setItem(UPDATED_FLAG_KEY, String(Date.now())); } catch { /* private mode */ }
  reload();
}

/** Read once after the update reload. */
export function takeUpdatedFlag(storage?: Storage): boolean {
  try {
    const s = storage ?? window.sessionStorage;
    const raw = s.getItem(UPDATED_FLAG_KEY);
    if (!raw) return false;
    s.removeItem(UPDATED_FLAG_KEY);
    return Date.now() - Number(raw) < 60_000;
  } catch {
    return false;
  }
}

export type UpdateButtonState = "idle" | "checking" | "updating" | "up-to-date" | "offline" | "failed";

export function updateButtonLabel(state: UpdateButtonState): string {
  switch (state) {
    case "checking": return "Checking…";
    case "updating": return "Updating…";
    case "up-to-date": return "Already up to date";
    case "offline": return "Offline. Connect to update";
    case "failed": return "Couldn't check. Try again";
    default: return "Update app";
  }
}

/**
 * The "Update app" tap: check, and if a newer version (or a newer offline
 * worker) is out, apply it straight away. Reports each step through onState.
 */
export async function runUpdateApp(onState: (s: UpdateButtonState) => void, deps: { check?: typeof checkForAppUpdate; apply?: typeof applyAppUpdate; refresh?: typeof refreshServiceWorkers } = {}): Promise<UpdateButtonState> {
  onState("checking");
  const [result, workerUpdate] = await Promise.all([(deps.check ?? checkForAppUpdate)(), (deps.refresh ?? refreshServiceWorkers)().catch(() => false)]);
  if (result.status === "offline" || result.status === "failed") {
    onState(result.status);
    return result.status;
  }
  if (result.status === "update-available" || workerUpdate) {
    onState("updating");
    await (deps.apply ?? applyAppUpdate)();
    return "updating";
  }
  onState("up-to-date");
  return "up-to-date";
}
