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
/** The page listing both apps, each with its own Get button (signed in or not). */
export const APPS_PAGE_PATH = "/apps";
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

/** sessionStorage key: which installed app this window was opened as (per window). */
export const APP_WINDOW_KEY = "mathgpl.appWindow";

/**
 * Which installed app a window belongs to, from how it was opened. Both apps
 * share the mathgpl.com origin, so "running as an installed app" alone never
 * says WHICH app: an Academia window must not make Mathemagine look installed
 * (or the other way round). The window is named once, at the first page it
 * loads: Academia opens at /academia-app, Mathemagine at /?source=mathemagine-app,
 * and older iPhones open at the install page the icon was added from.
 * Returns null in an ordinary browser tab.
 */
export function classifyAppWindow(s: { standalone: boolean; stored: string | null; pathname: string; search: string }): InstallApp | "unknown" | null {
  if (!s.standalone) return null;
  if (s.stored === "academia" || s.stored === "mathemagine") return s.stored;
  if (s.pathname.startsWith(ACADEMIA_START_URL) || s.pathname.startsWith(ACADEMIA_INSTALL_PATH)) return "academia";
  if (/[?&]source=mathemagine-app(&|$)/.test(s.search) || s.pathname.startsWith(MATHEMAGINE_INSTALL_PATH)) return "mathemagine";
  return "unknown";
}

const STANDALONE_JS = "navigator.standalone===true||['standalone','fullscreen','window-controls-overlay','minimal-ui'].some(function(m){return matchMedia('(display-mode: '+m+')').matches})";

/** Root <head> script: names this window's app the first time it loads (see classifyAppWindow). */
export const APP_WINDOW_SCRIPT =
  `(function(){try{if(!(${STANDALONE_JS})||sessionStorage.getItem(${JSON.stringify(APP_WINDOW_KEY)}))return;` +
  `var p=location.pathname,a=null;` +
  `if(p.indexOf(${JSON.stringify(ACADEMIA_START_URL)})===0||p.indexOf(${JSON.stringify(ACADEMIA_INSTALL_PATH)})===0)a='academia';` +
  `else if(/[?&]source=mathemagine-app(&|$)/.test(location.search)||p.indexOf(${JSON.stringify(MATHEMAGINE_INSTALL_PATH)})===0)a='mathemagine';` +
  `if(a)sessionStorage.setItem(${JSON.stringify(APP_WINDOW_KEY)},a)}catch(e){}})();`;

/** The installed app this window is, or null in a browser tab. */
export function currentAppWindow(): InstallApp | "unknown" | null {
  if (typeof window === "undefined") return null;
  let stored: string | null = null;
  try { stored = window.sessionStorage.getItem(APP_WINDOW_KEY); } catch { /* private mode */ }
  const nav = navigator as Navigator & { standalone?: boolean };
  const mm = (m: string) => typeof window.matchMedia === "function" && window.matchMedia(`(display-mode: ${m})`).matches;
  const standalone = nav.standalone === true || ["standalone", "fullscreen", "window-controls-overlay", "minimal-ui"].some(mm);
  return classifyAppWindow({ standalone, stored, pathname: window.location.pathname, search: window.location.search });
}

/**
 * Runs in <head> before the page draws:
 * - opened as THIS app (its icon, or older iPhones starting at the page the icon
 *   was added from): go straight on to the app itself. Opened inside the OTHER
 *   app's window, the page stays, so that app can still be installed;
 * - keeps Chrome's install offer for the Install button, however early it fires.
 */
export const installPageScript = (app: InstallApp) =>
  `(function(){try{var s=${STANDALONE_JS};var k=${JSON.stringify(APP_WINDOW_KEY)};var w=sessionStorage.getItem(k);` +
  `if(s&&!w){w=${JSON.stringify(app)};sessionStorage.setItem(k,w)}` +
  `if(s&&w===${JSON.stringify(app)}){location.replace(${JSON.stringify(APP_START[app])});return}}catch(e){}` +
  `addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__appInstallEvt=e;dispatchEvent(new Event('app-install-ready'))});` +
  `addEventListener('appinstalled',function(){window.__appInstallEvt=null;dispatchEvent(new Event('app-install-ready'))})})();`;

export type InstallBrowser = "chrome" | "edge" | "samsung" | "firefox" | "safari" | "other";

/** The browser, for the hand-written install steps shown when it gives no install offer. */
export function browserFor(ua: string): InstallBrowser {
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/edg(e|a|ios)?\//i.test(ua)) return "edge";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  if (/opr\/|opera|yabrowser|ucbrowser/i.test(ua)) return "other";
  if (/chrome|chromium|crios/i.test(ua)) return "chrome";
  if (/safari/i.test(ua)) return "safari";
  return "other";
}

/**
 * What to do when the browser has not offered an install (it was dismissed,
 * the app is already installed, the browser has no prompt, or this is another
 * app's window). The Install button never hides: it shows these steps instead.
 */
export function manualInstallSteps(args: { name: string; browser: InstallBrowser; mobile: boolean; ios: boolean; insideApp: InstallApp | "unknown" | null }): string[] {
  const { name, browser, mobile, ios, insideApp } = args;
  const browserApp = ios ? "Safari" : "Chrome or Edge";
  if (insideApp) {
    const inside = insideApp === "unknown" ? "an installed app" : `the ${insideApp === "academia" ? "Academia" : "Mathemagine"} app`;
    return [
      `This page is open inside ${inside}, and an app cannot install another app from inside itself.`,
      `Copy the link above, open ${browserApp}, paste it into the address bar, and install ${name} there.`,
    ];
  }
  const already = `If ${name} is already on this device, open it from its icon${mobile ? " on the Home Screen" : " (Start menu, Launchpad or the Dock)"}.`;
  if (ios) {
    return browser === "safari"
      ? [`Tap Share at the bottom of Safari, then Add to Home Screen, then Add.`, already]
      : [`Open this link in Safari: other iPhone browsers cannot add apps to the Home Screen.`, already];
  }
  if (browser === "firefox") return [`Firefox cannot install apps. Copy the link above and open it in ${mobile ? "Chrome" : "Chrome or Edge"}.`, already];
  if (browser === "other") return [`Copy the link above and open it in ${mobile ? "Chrome" : "Chrome or Edge"}, then tap Install ${name}.`, already];
  if (mobile) {
    if (browser === "samsung") return [`Tap the menu (three lines), then Add page to, then Home screen.`, already];
    return [`Tap the menu (three dots, top right), then Add to Home screen or Install app, then Install.`, already];
  }
  if (browser === "edge") return [`Open the menu (three dots), then Apps, then Install this site as an app, then Install.`, already];
  if (browser === "safari") return [`In Safari choose File, then Add to Dock, then Add.`, already];
  return [
    `Click the Install icon at the right end of the address bar, or open the menu (three dots), then Cast, save and share, then Install page as app.`,
    `If the address bar shows Open in another app instead, that is the other app: use the menu so ${name} is installed separately.`,
    already,
  ];
}

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
