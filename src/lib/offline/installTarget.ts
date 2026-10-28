/**
 * Which install route this device has. Pure so the decision is testable:
 * Apple only lets Safari add web apps to the Home Screen, Android can take a
 * direct app file, desktops use the browser's own install prompt.
 */
export type InstallTarget = "ios-safari" | "ios-other-browser" | "android" | "desktop";

export function installTargetFor(ua: string, maxTouchPoints = 0, platform = ""): InstallTarget {
  // iPadOS reports itself as a Mac; touch points give it away.
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (ios) {
    // Chrome, Firefox, Edge and in-app browsers (WhatsApp, Instagram, Facebook…)
    // on iPhone cannot add to the Home Screen in a way that keeps the app offline.
    const otherBrowser = /crios|fxios|edgios|opios|gsa\/|fban|fbav|instagram|whatsapp|line\/|snapchat|twitter|tiktok|musical_ly/i.test(ua);
    return otherBrowser ? "ios-other-browser" : "ios-safari";
  }
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** True when Academia was opened from its installed icon, not a browser tab. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    /wv\)/.test(navigator.userAgent)
  );
}
