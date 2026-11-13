// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { followInstalledApp } from "@/lib/install/appInstallPages";
import { DEVICE_SESSION_KEY, keepsDeviceSession, markDeviceSessionIfApp } from "@/lib/auth/deviceSession";
import { MATHEMAGINE_APP_LOGIN, MATHEMAGINE_START_URL } from "@/lib/install/mathemagineApp";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** A window whose display mode can flip from browser tab to app window, like Chrome's install. */
function fakeDisplayMode(initial: boolean) {
  let standalone = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = ((q: string) => ({
    get matches() { return standalone && q.includes("standalone"); },
    media: q,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return { becomeApp: () => { standalone = true; listeners.forEach((fn) => fn()); } };
}

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.useRealTimers();
});

describe("installing from a tab opens the app itself, not its install page", () => {
  it("the tab moved into the new Mathemagine window goes to the rotating building start page", () => {
    const mode = fakeDisplayMode(false);
    const replace = vi.fn();
    const stop = followInstalledApp("mathemagine", undefined, replace);
    expect(replace).not.toHaveBeenCalled();
    mode.becomeApp();
    expect(replace).toHaveBeenCalledWith(MATHEMAGINE_START_URL);
    expect(sessionStorage.getItem("mathgpl.appWindow")).toBe("mathemagine");
    stop();
  });
  it("Academia the same way, to /academia-app", () => {
    const mode = fakeDisplayMode(false);
    const replace = vi.fn();
    const stop = followInstalledApp("academia", undefined, replace);
    mode.becomeApp();
    expect(replace).toHaveBeenCalledWith("/academia-app");
    stop();
  });
  it("appinstalled while the page is still a browser tab (phones: Home Screen) leaves the tab alone", () => {
    vi.useFakeTimers();
    fakeDisplayMode(false);
    const replace = vi.fn();
    const stop = followInstalledApp("mathemagine", undefined, replace);
    window.dispatchEvent(new Event("appinstalled"));
    vi.advanceTimersByTime(15_000);
    expect(replace).not.toHaveBeenCalled();
    stop();
  });
  it("appinstalled, then the window move a moment later, still lands on the app", () => {
    vi.useFakeTimers();
    let standalone = false;
    window.matchMedia = ((q: string) => ({ get matches() { return standalone && q.includes("standalone"); }, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const replace = vi.fn();
    const stop = followInstalledApp("mathemagine", undefined, replace);
    window.dispatchEvent(new Event("appinstalled"));
    vi.advanceTimersByTime(500);
    standalone = true;
    vi.advanceTimersByTime(300);
    expect(replace).toHaveBeenCalledTimes(1);
    stop();
  });
  it("never hijacks the other app's window", () => {
    const mode = fakeDisplayMode(false);
    sessionStorage.setItem("mathgpl.appWindow", "academia");
    const replace = vi.fn();
    const stop = followInstalledApp("mathemagine", undefined, replace);
    mode.becomeApp();
    expect(replace).not.toHaveBeenCalled();
    stop();
  });
  it("is wired into the install page and the main site's install button", () => {
    expect(src("src/components/site/AppInstallPage.tsx")).toContain("return followInstalledApp(app);");
    expect(src("src/lib/install/mathemagineApp.ts")).toContain('followInstalledApp("mathemagine", MATHEMAGINE_START_URL)');
  });
});

describe("signed in on the app means signed in on this device until Log out", () => {
  it("an app window keeps the session and marks the device", () => {
    fakeDisplayMode(true);
    expect(keepsDeviceSession()).toBe(true);
    markDeviceSessionIfApp();
    expect(localStorage.getItem(DEVICE_SESSION_KEY)).toBe("1");
  });
  it("a plain browser tab is unchanged unless the person signed in through the app", () => {
    fakeDisplayMode(false);
    markDeviceSessionIfApp();
    expect(localStorage.getItem(DEVICE_SESSION_KEY)).toBeNull();
    expect(keepsDeviceSession()).toBe(false);
    localStorage.setItem(DEVICE_SESSION_KEY, "1");
    expect(keepsDeviceSession()).toBe(true);
  });
  it("Log out clears the mark", async () => {
    const { clearAccountLocalState } = await import("@/lib/auth/signOutEverywhere");
    localStorage.setItem(DEVICE_SESSION_KEY, "1");
    clearAccountLocalState();
    expect(localStorage.getItem(DEVICE_SESSION_KEY)).toBeNull();
  });
  it("neither the 15-minute away sign-out nor 'Remember me' unticked signs the app out", () => {
    expect(src("src/lib/auth/useIdleSignOut.ts")).toContain("&& !keepsDeviceSession()");
    expect(src("src/lib/auth/AuthProvider.tsx")).toContain('remember === "0" && !sameVisit && !keepsDeviceSession()');
    expect(src("src/lib/auth/AuthProvider.tsx")).toContain("markDeviceSessionIfApp()");
  });
  it("Log out inside the Mathemagine app returns to the building", () => {
    expect(src("src/lib/auth/signOutEverywhere.ts")).toContain('currentAppWindow() === "mathemagine" ? MATHEMAGINE_START_URL : "/login"');
  });
});

describe("the Mathemagine app opens on the rotating building with Login top right", () => {
  it("the front door shows the building in the app even when signed out", () => {
    const landing = src("src/routes/index.tsx");
    expect(landing).toContain('currentAppWindow() === "mathemagine"');
    expect(landing).toContain("user || inMathemagineApp ? <Index />");
  });
  it("signed out, the building is the platform's public one, read-only, and its doors lead to Login", () => {
    const index = src("src/pages/Index.tsx");
    expect(index).toContain('signedOut ? "platform-free"');
    expect(index).toContain("signedOut ? true : resolved.adsEnabled");
    expect(index).toContain("!signedOut && resolved.canChange");
    expect(index).toContain("publicFree: signedOut");
    expect(index).toContain("signedOut ? LOGIN_BACK_TO_APP");
  });
  it("Login at the top right returns to the building after signing in", () => {
    expect(MATHEMAGINE_APP_LOGIN).toBe("/login?next=%2F%3Fsource%3Dmathemagine-app");
    const bar = src("src/components/academy/AcademyTopBar.tsx");
    expect(bar).toContain('data-testid="app-login"');
    expect(bar).toContain("to={MATHEMAGINE_APP_LOGIN}");
  });
});
