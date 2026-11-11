/**
 * One install page per app, so a copied link always means one app.
 *
 * The shared download page lists both apps. Each app's button opens its own
 * page (`/install/academia`, `/install/mathemagine`). That page's server-sent
 * <head> carries only that app's manifest, Home Screen icon and title, so
 * iPhone Safari's Add to Home Screen (which reads the page it is on) and
 * Chrome's Install both pick the right app. Static per route, never swapped
 * in the browser: Safari reads these tags from the page as loaded.
 */
import { useEffect, useState } from "react";
import { ACADEMIA_MANIFEST_HREF, MATHEMAGINE_MANIFEST_HREF, MATHEMAGINE_START_URL, type DeferredInstall } from "@/lib/install/mathemagineApp";

export type InstallApp = "academia" | "mathemagine";

export const ACADEMIA_INSTALL_PATH = "/install/academia";
export const MATHEMAGINE_INSTALL_PATH = "/install/mathemagine";
export const ACADEMIA_START_URL = "/academia-app";

/** Where each app opens once installed. */
export const APP_START: Record<InstallApp, string> = { academia: ACADEMIA_START_URL, mathemagine: MATHEMAGINE_START_URL };
export const INSTALL_PATH: Record<InstallApp, string> = { academia: ACADEMIA_INSTALL_PATH, mathemagine: MATHEMAGINE_INSTALL_PATH };

/** Pages that belong to the Academia app (its own install prompt, never Mathemagine's). */
export const isAcademiaPath = (pathname: string) => pathname.startsWith("/academia-app") || pathname.startsWith(ACADEMIA_INSTALL_PATH);

/** The link "Copy link" copies: this install page's own address, nothing else. */
export function installPageLink(app: InstallApp, loc?: { origin: string; pathname: string }): string {
  const here = loc ?? (typeof window === "undefined" ? undefined : window.location);
  const origin = here?.origin && here.origin !== "null" ? here.origin : "https://mathgpl.com";
  const path = here?.pathname === INSTALL_PATH[app] ? here.pathname : INSTALL_PATH[app];
  return `${origin}${path}`;
}

const ICON: Record<InstallApp, string> = { academia: "/academia-icon-192.png", mathemagine: "/mathemagine-apple-touch-icon.png" };
const NAME: Record<InstallApp, string> = { academia: "Academia", mathemagine: "Mathemagine" };
const MANIFEST: Record<InstallApp, string> = { academia: ACADEMIA_MANIFEST_HREF, mathemagine: MATHEMAGINE_MANIFEST_HREF };

/**
 * Runs in <head> before the page draws:
 * - opened from a Home Screen icon (older iPhones start at the page the app was
 *   added from, not the manifest start page): go straight to the app itself;
 * - keeps Chrome's install offer for the Install button, however early it fires.
 */
export const installPageScript = (app: InstallApp) =>
  `(function(){try{var s=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;if(s){location.replace(${JSON.stringify(APP_START[app])});return}}catch(e){}` +
  `addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__appInstallEvt=e;dispatchEvent(new Event('app-install-ready'))});` +
  `addEventListener('appinstalled',function(){window.__appInstallEvt=null;dispatchEvent(new Event('app-install-ready'))})})();`;

/** Everything one install page's <head> needs, for its app only. */
export function installPageHead(app: InstallApp) {
  const name = NAME[app];
  return {
    meta: [
      { title: `Install ${name}` },
      { name: "description", content: app === "academia" ? "Put the Academia app on your phone, tablet or computer. Works offline." : "Put the Mathemagine app on your phone, tablet or computer." },
      { name: "theme-color", content: "#0b1226" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: name },
      { name: "application-name", content: name },
    ],
    links: [
      { rel: "manifest", href: MANIFEST[app] },
      { rel: "apple-touch-icon", href: ICON[app] },
    ],
    scripts: [{ children: installPageScript(app) }],
  };
}

type Win = Window & { __appInstallEvt?: DeferredInstall | null };

/** The browser's install offer for this page's app, kept by the head script. */
export function useAppInstallPrompt(): { ready: boolean; prompt: () => Promise<"accepted" | "dismissed" | "unavailable"> } {
  const [evt, setEvt] = useState<DeferredInstall | null>(null);
  useEffect(() => {
    const w = window as Win;
    const sync = () => setEvt(w.__appInstallEvt ?? null);
    const onPrompt = (e: Event) => { e.preventDefault(); w.__appInstallEvt = e as DeferredInstall; sync(); };
    sync();
    window.addEventListener("app-install-ready", sync);
    // Also listen here in case the head script did not run (tests, odd browsers).
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => { window.removeEventListener("app-install-ready", sync); window.removeEventListener("beforeinstallprompt", onPrompt); };
  }, []);
  const prompt = async () => {
    const e = evt;
    if (!e) return "unavailable" as const;
    (window as Win).__appInstallEvt = null;
    setEvt(null);
    await e.prompt();
    const choice = await e.userChoice?.catch(() => undefined);
    return choice?.outcome === "accepted" ? ("accepted" as const) : ("dismissed" as const);
  };
  return { ready: evt != null, prompt };
}
