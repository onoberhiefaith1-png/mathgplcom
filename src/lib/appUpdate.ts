/**
 * "Update app": brings an installed app (Mathemagine or Academia) — or an open
 * tab — onto the latest published version of mathgpl.com.
 *
 * Installed apps are a single long-lived page. Phones keep them in memory for
 * days, Electron and Android have their own HTTP caches, and the offline
 * worker (scope "/") can keep an older document or hashed JS in Cache Storage.
 * A soft location.reload() is not enough. A manual Update always fetches the
 * live version, unregisters workers, drops JS/HTML caches (never lesson media,
 * packs, IndexedDB, cookies or login), and navigates to a cache-busted URL.
 */
export type UpdateStatus = "update-available" | "up-to-date" | "offline" | "failed";

/** Lesson media and packs — never deleted by an app-shell update. */
export const KEEP_CACHES = ["academia-media", "academia-pack"] as const;
/** @deprecated Use KEEP_CACHES. Old name referred only to the page cache. */
export const STALE_PAGE_CACHES = ["academia-pages"];
/** Set just before the update reload, read once afterwards to say "Updated to the latest version". */
export const UPDATED_FLAG_KEY = "mathgpl.appUpdated";
/** Build id baked in at publish time; compared with the live version manifest. */
export const APP_BUILD_ID = (import.meta.env.VITE_APP_BUILD_ID as string | undefined) || "dev";
export const APP_VERSION_URL = "/app-version.json";
export const APP_VERSION_API = "/api/public/app-version";
export const RELOAD_PARAM = "__v";

export function publishedBuild(data: unknown): string {
  if (data && typeof data === "object" && "build" in data && typeof (data as { build: unknown }).build === "string") {
    return (data as { build: string }).build;
  }
  return "";
}

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

export function cacheBypassInit(): RequestInit {
  return { cache: "no-store", credentials: "same-origin", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } };
}

/** Current path with a fresh cache-bust query; keeps hash and other params; drops a previous __v. */
export function liveReloadUrl(loc: Pick<Location, "pathname" | "search" | "hash"> = typeof window === "undefined" ? { pathname: "/", search: "", hash: "" } : window.location, now: number = Date.now()): string {
  const params = new URLSearchParams(loc.search);
  params.delete(RELOAD_PARAM);
  params.set(RELOAD_PARAM, String(now));
  const search = params.toString();
  return `${loc.pathname}?${search}${loc.hash}`;
}

/** Navigate so the next document must be fetched from the network, not a soft reload. */
export function hardReload(href: string = liveReloadUrl(), assign: (url: string) => void = (url) => { window.location.replace(url); }): void {
  assign(href);
}

export type DesktopCacheBridge = { clearWebCache?: () => Promise<void> };

export function desktopCacheBridge(win: Window | undefined = typeof window === "undefined" ? undefined : window): DesktopCacheBridge | undefined {
  return (win as unknown as { mathgplDesktop?: DesktopCacheBridge } | undefined)?.mathgplDesktop;
}

export function androidCacheBridge(win: Window | undefined = typeof window === "undefined" ? undefined : window): { clearCache?: () => void } | undefined {
  return (win as unknown as { Android?: { clearCache?: () => void } } | undefined)?.Android;
}

export function shouldKeepCache(name: string, keep: readonly string[] = KEEP_CACHES): boolean {
  return keep.includes(name);
}

/** Unregister every worker after asking any waiting one to activate. */
export async function unregisterServiceWorkers(sw: ServiceWorkerContainer | undefined = typeof navigator === "undefined" ? undefined : navigator.serviceWorker): Promise<number> {
  if (!sw?.getRegistrations) return 0;
  const regs = await sw.getRegistrations().catch(() => [] as readonly ServiceWorkerRegistration[]);
  let n = 0;
  for (const reg of regs) {
    await reg.update().catch(() => undefined);
    reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    if (await reg.unregister().catch(() => false)) n += 1;
  }
  return n;
}

/** Asks the offline worker (if any) to check for a newer version. True when one is installing or waiting. */
export async function refreshServiceWorkers(sw: ServiceWorkerContainer | undefined = typeof navigator === "undefined" ? undefined : navigator.serviceWorker): Promise<boolean> {
  if (!sw?.getRegistrations) return false;
  let found = false;
  const regs = await sw.getRegistrations().catch(() => [] as readonly ServiceWorkerRegistration[]);
  for (const reg of regs) {
    await reg.update().catch(() => undefined);
    if (reg.waiting || reg.installing) found = true;
    reg.waiting?.postMessage({ type: "SKIP_WAITING" });
  }
  return found;
}

export async function deleteStaleCaches(cacheStorage: Pick<CacheStorage, "keys" | "delete"> | undefined = typeof caches === "undefined" ? undefined : caches): Promise<string[]> {
  if (!cacheStorage?.keys) return [];
  const deleted: string[] = [];
  try {
    const names = await cacheStorage.keys();
    await Promise.all(names.map(async (n) => {
      if (shouldKeepCache(n)) return;
      if (await cacheStorage.delete(n).catch(() => false)) deleted.push(n);
    }));
  } catch { /* caches unavailable */ }
  return deleted;
}

export async function checkForAppUpdate(deps: {
  fetchImpl?: typeof fetch;
  online?: boolean;
  loaded?: string[];
  runningBuild?: string;
} = {}): Promise<{ status: UpdateStatus; published: string[] }> {
  const online = deps.online ?? (typeof navigator === "undefined" || navigator.onLine);
  if (!online) return { status: "offline", published: [] };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cacheOpts = cacheBypassInit();
  const stamp = Date.now();
  try {
    // Prefer a no-store API, then the static manifest, then HTML fingerprints.
    for (const path of [APP_VERSION_API, APP_VERSION_URL]) {
      const versionRes = await fetchImpl(`${path}?__update_check=${stamp}`, cacheOpts);
      if (!versionRes.ok) continue;
      const build = publishedBuild(await versionRes.json().catch(() => null));
      const running = deps.runningBuild ?? APP_BUILD_ID;
      if (build && running && running !== "dev") {
        return { status: build !== running ? "update-available" : "up-to-date", published: [build] };
      }
      if (build) break;
    }
    const pages = ["/", "/academia-app"];
    let published: string[] = [];
    let sawPage = false;
    for (const path of pages) {
      const res = await fetchImpl(`${path}?__update_check=${stamp}`, cacheOpts);
      if (!res.ok) continue;
      sawPage = true;
      published = publishedEntry(await res.text());
      if (published.length) break;
    }
    if (!sawPage) return { status: "failed", published: [] };
    const loaded = deps.loaded ?? loadedEntryAssets();
    return { status: isNewerBuild(loaded, published) ? "update-available" : "up-to-date", published };
  } catch {
    return { status: "failed", published: [] };
  }
}

/**
 * Drops stale HTML/JS caches, unregisters workers, asks the native shell to
 * clear its HTTP cache when a bridge is present, then hard-navigates to a
 * cache-busted live URL. Never touches IndexedDB, cookies or localStorage.
 */
export async function applyAppUpdate(
  reload: (href: string) => void = (href) => hardReload(href),
  deps: {
    unregister?: typeof unregisterServiceWorkers;
    caches?: Pick<CacheStorage, "keys" | "delete">;
    desktop?: DesktopCacheBridge;
    android?: { clearCache?: () => void };
    href?: string;
  } = {},
): Promise<void> {
  await (deps.unregister ?? unregisterServiceWorkers)().catch(() => 0);
  await deleteStaleCaches(deps.caches).catch(() => []);
  const desktop = deps.desktop ?? desktopCacheBridge();
  if (desktop?.clearWebCache) await desktop.clearWebCache().catch(() => undefined);
  try { (deps.android ?? androidCacheBridge())?.clearCache?.(); } catch { /* no Android bridge */ }
  try { window.sessionStorage.setItem(UPDATED_FLAG_KEY, String(Date.now())); } catch { /* private mode */ }
  reload(deps.href ?? liveReloadUrl());
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
    case "up-to-date": return "Up to date";
    case "offline": return "Offline. Connect to update";
    case "failed": return "Couldn't check. Try again";
    default: return "Update app";
  }
}

export function shortBuildId(build: string): string {
  if (!build || build === "dev") return build || "dev";
  return build.length <= 12 ? build : build.slice(0, 12);
}

/**
 * The Update tap. Manual (the buttons): always apply when online so the app
 * reloads onto whatever mathgpl.com is serving. Auto (the in-app prompt):
 * only apply when a newer version is detected, so a lesson is never cut off.
 */
export async function runUpdateApp(
  onState: (s: UpdateButtonState) => void,
  deps: {
    check?: typeof checkForAppUpdate;
    apply?: typeof applyAppUpdate;
    refresh?: typeof refreshServiceWorkers;
    mode?: "manual" | "auto";
  } = {},
): Promise<UpdateButtonState> {
  onState("checking");
  const mode = deps.mode ?? "manual";
  const [result, workerUpdate] = await Promise.all([(deps.check ?? checkForAppUpdate)(), (deps.refresh ?? refreshServiceWorkers)().catch(() => false)]);
  if (result.status === "offline" || result.status === "failed") {
    onState(result.status);
    return result.status;
  }
  const shouldApply = mode === "manual" || result.status === "update-available" || workerUpdate;
  if (shouldApply) {
    onState("updating");
    await (deps.apply ?? applyAppUpdate)();
    return "updating";
  }
  onState("up-to-date");
  return "up-to-date";
}
