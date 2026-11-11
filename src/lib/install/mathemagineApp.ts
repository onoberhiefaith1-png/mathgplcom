/**
 * The installable Mathemagine app: the main website opened from its own icon.
 *
 * It is a separate app from Academia (`/academia-app`, `academia-app.webmanifest`):
 * different manifest id, start page, name source and icons. It registers NO
 * service worker. Only one worker can own scope "/", and that worker belongs to
 * offline Academia (`/sw.js`), so registering another here would break
 * Academia offline.
 */
import { useEffect, useState } from "react";

export const MATHEMAGINE_MANIFEST_HREF = "/mathemagine.webmanifest";
export const MATHEMAGINE_APP_ID = "/?app=mathemagine";
export const MATHEMAGINE_START_URL = "/?source=mathemagine-app";
export const ACADEMIA_MANIFEST_HREF = "/academia-app.webmanifest";

/** Head tags for the main-website pages a visitor can install Mathemagine from. */
export const mathemagineInstallHead = {
  meta: [
    { name: "theme-color", content: "#0b1226" },
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-title", content: "Mathemagine" },
    { name: "application-name", content: "Mathemagine" },
  ],
  links: [
    { rel: "manifest", href: MATHEMAGINE_MANIFEST_HREF },
    { rel: "apple-touch-icon", href: "/mathemagine-apple-touch-icon.png" },
  ],
};

export type DeferredInstall = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };

// The browser fires beforeinstallprompt once, often before any dialog is
// open, so the event is kept here until the teacher taps Install.
let deferred: DeferredInstall | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
let listening = false;

export function listenForMathemagineInstall(): () => void {
  if (typeof window === "undefined" || listening) return () => undefined;
  // Academia's own page handles its own prompt for its own manifest, and each
  // /install/<app> page keeps its own app's prompt (see appInstallPages.ts).
  const path = window.location.pathname;
  if (path.startsWith("/academia-app") || path.startsWith("/install/")) return () => undefined;
  listening = true;
  const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as DeferredInstall; notify(); };
  const onInstalled = () => { deferred = null; notify(); };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    listening = false;
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export async function promptMathemagineInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const evt = deferred;
  if (!evt) return "unavailable";
  deferred = null;
  notify();
  await evt.prompt();
  const choice = await evt.userChoice?.catch(() => undefined);
  return choice?.outcome === "accepted" ? "accepted" : "dismissed";
}

/** True while the browser is holding an install prompt for Mathemagine. */
export function useMathemagineInstallPrompt(): boolean {
  const [ready, setReady] = useState(() => deferred != null);
  useEffect(() => {
    const fn = () => setReady(deferred != null);
    listeners.add(fn);
    fn();
    return () => { listeners.delete(fn); };
  }, []);
  return ready;
}

/** Test hook. */
export function __setDeferredInstallForTest(e: DeferredInstall | null) { deferred = e; notify(); }

export type MathemagineDevice = "android" | "ios" | "windows" | "mac";

/**
 * Mathemagine install steps, laid out exactly like Academia's: "copy" puts the
 * app on a device from its own install page; "download" installs it right here.
 */
export const MATHEMAGINE_COPY_STEPS: Record<MathemagineDevice, string[]> = {
  android: [
    "Tap Copy link below and open the link in Chrome on the Android phone (send it to yourself if you are on another device).",
    "On the phone, tap Install Mathemagine, or open the Chrome menu and choose Install app (or Add to Home screen).",
    "Open Mathemagine from its new gold M icon.",
  ],
  ios: [
    "Tap Copy link below and open the link in Safari on the iPhone or iPad.",
    "In Safari tap Share, then Add to Home Screen, then Add.",
    "Open Mathemagine from its new gold M icon.",
  ],
  windows: [
    "Click Copy link below and open the link in Chrome or Edge on the computer.",
    "Click Install Mathemagine, or the Install icon at the right of the address bar.",
    "Mathemagine opens in its own window and appears in the Start menu.",
  ],
  mac: [
    "Click Copy link below and open the link in Chrome or Edge on the Mac (in Safari: File, then Add to Dock).",
    "Click Install Mathemagine, or the Install icon at the right of the address bar.",
    "Mathemagine opens in its own window and appears in Launchpad.",
  ],
};

/** No Mathemagine installer file is built yet, so Download installs it from the browser. iPhone has no download. */
export const MATHEMAGINE_DOWNLOAD_STEPS: Record<MathemagineDevice, string[]> = {
  android: [
    "Tap Install Mathemagine below (use Chrome).",
    "Tap Install in the box that opens. Mathemagine appears on your Home screen with its gold M icon.",
  ],
  ios: [],
  windows: [
    "Click Install Mathemagine below (use Chrome or Edge).",
    "Click Install in the box that opens. Mathemagine opens in its own window and appears in the Start menu.",
  ],
  mac: [
    "Click Install Mathemagine below (use Chrome or Edge).",
    "Click Install in the box that opens. Mathemagine opens in its own window and appears in Launchpad.",
  ],
};
