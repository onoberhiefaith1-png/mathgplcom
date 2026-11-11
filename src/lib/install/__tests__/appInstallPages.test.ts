import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { Route as AcademiaInstall } from "@/routes/install/academia";
import { Route as MathemagineInstall } from "@/routes/install/mathemagine";
import { installPageLink, installPageScript, isAcademiaPath } from "@/lib/install/appInstallPages";

type Head = { meta: Record<string, string>[]; links: { rel: string; href: string }[]; scripts: { children: string }[] };
const headOf = (r: { options: { head?: unknown } }) => (r.options.head as () => Head)();
const meta = (h: Head, name: string) => h.meta.filter((m) => m.name === name).map((m) => m.content);
const link = (h: Head, rel: string) => h.links.filter((l) => l.rel === rel).map((l) => l.href);
const json = (p: string) => JSON.parse(readFileSync(join(process.cwd(), p), "utf8"));

describe("each app has its own install page", () => {
  it("exist at /install/academia and /install/mathemagine", () => {
    expect(readFileSync(join(process.cwd(), "src/routes/install/academia.tsx"), "utf8")).toContain('createFileRoute("/install/academia")');
    expect(readFileSync(join(process.cwd(), "src/routes/install/mathemagine.tsx"), "utf8")).toContain('createFileRoute("/install/mathemagine")');
    const tree = readFileSync(join(process.cwd(), "src/routeTree.gen.ts"), "utf8");
    expect(tree).toContain("path: '/install/academia'");
    expect(tree).toContain("path: '/install/mathemagine'");
  });

  it("Academia's page carries only Academia's manifest, icon and Home Screen title", () => {
    const h = headOf(AcademiaInstall);
    expect(link(h, "manifest")).toEqual(["/academia-app.webmanifest"]);
    expect(link(h, "apple-touch-icon")).toEqual(["/academia-icon-192.png"]);
    expect(meta(h, "apple-mobile-web-app-title")).toEqual(["Academia"]);
    expect(meta(h, "apple-mobile-web-app-capable")).toEqual(["yes"]);
    expect(meta(h, "theme-color")).toEqual(["#0b1226"]);
    expect(JSON.stringify(h)).not.toContain("athemagine");
    const m = json("public/academia-app.webmanifest");
    expect({ id: m.id, name: m.name, start_url: m.start_url }).toEqual({ id: "/academia-app", name: "Academia", start_url: "/academia-app" });
  });

  it("Mathemagine's page carries only Mathemagine's manifest, gold M icon and Home Screen title", () => {
    const h = headOf(MathemagineInstall);
    expect(link(h, "manifest")).toEqual(["/mathemagine.webmanifest"]);
    expect(link(h, "apple-touch-icon")).toEqual(["/mathemagine-apple-touch-icon.png"]);
    expect(meta(h, "apple-mobile-web-app-title")).toEqual(["Mathemagine"]);
    expect(meta(h, "theme-color")).toEqual(["#0b1226"]);
    expect(JSON.stringify(h)).not.toContain("cademia");
    expect(json("public/mathemagine.webmanifest").name).toBe("Mathemagine");
  });

  it("the site-wide head adds no manifest or Home Screen tags that could clash", () => {
    const rootFile = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(rootFile).not.toMatch(/rel:\s*"manifest"|apple-touch-icon|apple-mobile-web-app-title/);
  });

  it("copy link is always this page's own install address", () => {
    expect(installPageLink("academia", { origin: "https://mathgpl.com", pathname: "/install/academia" })).toBe("https://mathgpl.com/install/academia");
    expect(installPageLink("mathemagine", { origin: "https://www.mathgpl.com", pathname: "/install/mathemagine" })).toBe("https://www.mathgpl.com/install/mathemagine");
    expect(installPageLink("academia", { origin: "null", pathname: "" })).toBe("https://mathgpl.com/install/academia");
  });

  it("opened from a Home Screen icon, the page goes straight on to the app", () => {
    for (const [app, start] of [["academia", "/academia-app"], ["mathemagine", "/?source=mathemagine-app"]] as const) {
      const dom = new JSDOM("<!doctype html>", { url: `https://mathgpl.com/install/${app}`, runScripts: "outside-only" });
      dom.window.eval(`window.__r=[];Object.defineProperty(navigator,'standalone',{value:true});window.matchMedia=function(){return{matches:false}};`);
      // location.replace is not configurable in jsdom; wrap the script with a stand-in location.
      dom.window.eval(`(function(location){${installPageScript(app)}})({replace:function(u){window.__r.push(u)}})`);
      expect((dom.window as unknown as { __r: string[] }).__r).toEqual([start]);
    }
  });

  it("in a browser tab, the page stays and keeps the install offer for its button", () => {
    const dom = new JSDOM("<!doctype html>", { url: "https://mathgpl.com/install/academia", runScripts: "outside-only" });
    dom.window.eval(`window.matchMedia=function(){return{matches:false}};window.__r=[];(function(location){${installPageScript("academia")}})({replace:function(u){window.__r.push(u)}})`);
    expect((dom.window as unknown as { __r: string[] }).__r).toEqual([]);
    const e = new dom.window.Event("beforeinstallprompt", { cancelable: true });
    dom.window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect((dom.window as unknown as { __appInstallEvt: Event }).__appInstallEvt).toBe(e);
  });

  it("Mathemagine's site-wide prompt catcher leaves the install pages and Academia alone", () => {
    expect(isAcademiaPath("/install/academia")).toBe(true);
    expect(isAcademiaPath("/academia-app")).toBe(true);
    expect(isAcademiaPath("/install/mathemagine")).toBe(false);
    const src = readFileSync(join(process.cwd(), "src/lib/install/mathemagineApp.ts"), "utf8");
    expect(src).toContain('path.startsWith("/install/")');
  });

  it("Academia's install page is saved for offline too, and the offline worker is unchanged", () => {
    const prep = readFileSync(join(process.cwd(), "src/lib/offline/prepareOffline.ts"), "utf8");
    expect(prep).toContain("c.add(ACADEMIA_INSTALL_PATH)");
    expect(prep).toContain('c.add("/academia-app")');
    expect(readFileSync(join(process.cwd(), "src/lib/offline/registerAcademiaSW.ts"), "utf8")).toContain('register("/sw.js", { scope: "/" })');
  });
});
