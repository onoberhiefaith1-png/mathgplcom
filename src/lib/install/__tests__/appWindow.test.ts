import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { APP_WINDOW_SCRIPT, browserFor, classifyAppWindow, installPageScript, manualInstallSteps } from "@/lib/install/appInstallPages";
import { Route as AppsRoute } from "@/routes/apps";

const tab = { standalone: false, stored: null, pathname: "/", search: "" };

describe("which installed app a window is", () => {
  it("a browser tab is no app, so both apps can be installed from it", () => {
    expect(classifyAppWindow(tab)).toBeNull();
  });
  it("is named by how the window opened, not by 'some app is installed'", () => {
    expect(classifyAppWindow({ ...tab, standalone: true, pathname: "/academia-app" })).toBe("academia");
    expect(classifyAppWindow({ ...tab, standalone: true, search: "?source=mathemagine-app" })).toBe("mathemagine");
    expect(classifyAppWindow({ ...tab, standalone: true, pathname: "/install/academia" })).toBe("academia");
    expect(classifyAppWindow({ ...tab, standalone: true, pathname: "/install/mathemagine" })).toBe("mathemagine");
    // Remembered for the window, wherever it navigates later.
    expect(classifyAppWindow({ ...tab, standalone: true, stored: "academia", pathname: "/install/mathemagine" })).toBe("academia");
    expect(classifyAppWindow({ ...tab, standalone: true, pathname: "/home" })).toBe("unknown");
  });
  it("the root head script records it once per window", () => {
    const run = (url: string, standalone: boolean, preset?: string) => {
      const dom = new JSDOM("<!doctype html>", { url, runScripts: "outside-only" });
      if (preset) dom.window.sessionStorage.setItem("mathgpl.appWindow", preset);
      dom.window.eval(`window.matchMedia=function(q){return{matches:${standalone}&&q.indexOf('standalone')>=0}};${APP_WINDOW_SCRIPT}`);
      return dom.window.sessionStorage.getItem("mathgpl.appWindow");
    };
    expect(run("https://mathgpl.com/academia-app", true)).toBe("academia");
    expect(run("https://mathgpl.com/?source=mathemagine-app", true)).toBe("mathemagine");
    expect(run("https://mathgpl.com/?source=mathemagine-app", false)).toBeNull();
    expect(run("https://mathgpl.com/academia-app", true, "mathemagine")).toBe("mathemagine");
    const root = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toContain("__html: APP_WINDOW_SCRIPT");
  });
});

describe("an install page opened inside the other app's window", () => {
  const run = (app: "academia" | "mathemagine", stored: string | null) => {
    const dom = new JSDOM("<!doctype html>", { url: `https://mathgpl.com/install/${app}`, runScripts: "outside-only" });
    if (stored) dom.window.sessionStorage.setItem("mathgpl.appWindow", stored);
    dom.window.eval(`window.matchMedia=function(q){return{matches:q.indexOf('standalone')>=0}};window.__r=[];(function(location){${installPageScript(app)}})({replace:function(u){window.__r.push(u)}})`);
    return (dom.window as unknown as { __r: string[] }).__r;
  };
  it("stays, so the second app can be installed (it used to jump into the first app)", () => {
    expect(run("mathemagine", "academia")).toEqual([]);
    expect(run("academia", "mathemagine")).toEqual([]);
  });
  it("still goes straight on when it IS this app's own icon", () => {
    expect(run("academia", "academia")).toEqual(["/academia-app"]);
    expect(run("mathemagine", null)).toEqual(["/?source=mathemagine-app"]);
  });
});

describe("hand-written install steps when the browser gives no install offer", () => {
  const UA = {
    chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
    edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36 Edg/130",
    safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
    firefox: "Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0",
    samsung: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121 Mobile Safari/537.36",
    iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/130 Mobile Safari/604.1",
  };
  it("knows the browser", () => {
    expect(browserFor(UA.chromeWin)).toBe("chrome");
    expect(browserFor(UA.edge)).toBe("edge");
    expect(browserFor(UA.safariMac)).toBe("safari");
    expect(browserFor(UA.firefox)).toBe("firefox");
    expect(browserFor(UA.samsung)).toBe("samsung");
    expect(browserFor(UA.iphoneChrome)).toBe("chrome");
  });
  const steps = (browser: ReturnType<typeof browserFor>, extra: Partial<Parameters<typeof manualInstallSteps>[0]> = {}) =>
    manualInstallSteps({ name: "Mathemagine", browser, mobile: false, ios: false, insideApp: null, ...extra }).join(" ");
  it("gives each browser its own menu path", () => {
    expect(steps("chrome")).toContain("Install page as app");
    expect(steps("edge")).toContain("Install this site as an app");
    expect(steps("safari")).toContain("Add to Dock");
    expect(steps("firefox")).toContain("Firefox cannot install apps");
    expect(steps("chrome", { mobile: true })).toContain("Add to Home screen");
    expect(steps("samsung", { mobile: true })).toContain("Add page to");
    expect(steps("safari", { mobile: true, ios: true })).toContain("Add to Home Screen");
    expect(steps("chrome", { mobile: true, ios: true })).toContain("Open this link in Safari");
  });
  it("inside another app's window, says to use the browser instead", () => {
    expect(steps("chrome", { insideApp: "academia" })).toContain("inside the Academia app");
    expect(steps("safari", { insideApp: "mathemagine", ios: true, mobile: true })).toContain("open Safari");
  });
});

describe("the download is reachable at every width and when signed in", () => {
  it("/apps lists both apps and carries the Mathemagine manifest", () => {
    const head = (AppsRoute.options.head as () => { links: { rel: string; href: string }[] })();
    expect(head.links.find((l) => l.rel === "manifest")?.href).toBe("/mathemagine.webmanifest");
    expect(readFileSync(join(process.cwd(), "src/routeTree.gen.ts"), "utf8")).toContain("path: '/apps'");
  });
  it("the front-page header shows it from tablet width up (it needed 1440px before)", () => {
    const welcome = readFileSync(join(process.cwd(), "src/pages/WelcomePage.tsx"), "utf8");
    expect(welcome).not.toContain("min-[1440px]:inline-flex");
    expect(welcome).toContain('<span className="hidden md:inline-flex">{downloadButton(false)}</span>');
    expect(welcome).toContain("md:hidden");
  });
  it("the account menu links to it, signed in and signed out", () => {
    const menu = readFileSync(join(process.cwd(), "src/components/academy/AccountMenu.tsx"), "utf8");
    expect(menu.match(/href=\{APPS_PAGE_PATH\}/g)?.length).toBe(2);
  });
  it("the two apps stay separate apps to the browser", () => {
    const m = JSON.parse(readFileSync(join(process.cwd(), "public/mathemagine.webmanifest"), "utf8"));
    const a = JSON.parse(readFileSync(join(process.cwd(), "public/academia-app.webmanifest"), "utf8"));
    expect(m.id).not.toBe(a.id);
    expect(m.start_url).not.toBe(a.start_url);
    expect(m.name).not.toBe(a.name);
  });
});
