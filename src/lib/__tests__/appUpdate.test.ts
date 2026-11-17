// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  applyAppUpdate, checkForAppUpdate, entryAssets, isNewerBuild, publishedBuild, publishedEntry,
  runUpdateApp, takeUpdatedFlag, updateButtonLabel, UPDATED_FLAG_KEY,
} from "@/lib/appUpdate";

const page = (entry: string) =>
  `<head><link rel="modulepreload" href="/assets/index-Shared1.js"/><link rel="modulepreload" href="${entry}"/></head>` +
  `<body><script>x</script><script type="module" async="" src="${entry}"></script></body>`;

describe("app update: version fingerprint", () => {
  it("reads the published start script, not shared chunks", () => {
    expect(publishedEntry(page("/assets/index-Ab1ooREV.js"))).toEqual(["/assets/index-Ab1ooREV.js"]);
    expect(publishedEntry("<html>no scripts</html>")).toEqual([]);
  });
  it("collects loaded entry files", () => {
    expect(entryAssets("/assets/index-B.js /assets/foo-1.js /assets/index-A.js /assets/index-B.js")).toEqual(["/assets/index-A.js", "/assets/index-B.js"]);
  });
  it("only calls it newer when the published start script was not loaded", () => {
    expect(isNewerBuild(["/assets/index-A.js"], ["/assets/index-A.js"])).toBe(false);
    expect(isNewerBuild(["/assets/index-A.js"], ["/assets/index-B.js"])).toBe(true);
    expect(isNewerBuild([], ["/assets/index-B.js"])).toBe(false);
    expect(isNewerBuild(["/assets/index-A.js"], [])).toBe(false);
  });
});

describe("app update: check", () => {
  const html = (entry: string) => vi.fn(async () => new Response(page(entry), { status: 200 })) as unknown as typeof fetch;
  it("asks the network, bypassing caches", async () => {
    const f = html("/assets/index-A.js");
    await checkForAppUpdate({ fetchImpl: f, online: true, loaded: ["/assets/index-A.js"], runningBuild: "dev" });
    const calls = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls[0]![0]).toMatch(/^\/app-version\.json\?__update_check=\d+$/);
    expect(calls.some(([url]) => /^\/\?__update_check=\d+$/.test(url))).toBe(true);
    expect(calls[0]![1].cache).toBe("no-store");
  });
  it("up to date / update available / offline / failed", async () => {
    expect((await checkForAppUpdate({ fetchImpl: html("/assets/index-A.js"), online: true, loaded: ["/assets/index-A.js"], runningBuild: "dev" })).status).toBe("up-to-date");
    expect((await checkForAppUpdate({ fetchImpl: html("/assets/index-B.js"), online: true, loaded: ["/assets/index-A.js"], runningBuild: "dev" })).status).toBe("update-available");
    expect((await checkForAppUpdate({ online: false })).status).toBe("offline");
    const bad = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    expect((await checkForAppUpdate({ fetchImpl: bad, online: true, loaded: ["/assets/index-A.js"] })).status).toBe("failed");
    const thrown = vi.fn(async () => { throw new TypeError("net"); }) as unknown as typeof fetch;
    expect((await checkForAppUpdate({ fetchImpl: thrown, online: true })).status).toBe("failed");
  });
});

describe("app update: the Update app tap", () => {
  const states = () => { const s: string[] = []; return { s, on: (x: string) => s.push(x) }; };
  it("applies a newer version straight away", async () => {
    const { s, on } = states();
    const apply = vi.fn(async () => {});
    const out = await runUpdateApp(on, { check: async () => ({ status: "update-available", published: [] }), refresh: async () => false, apply });
    expect(out).toBe("updating");
    expect(s).toEqual(["checking", "updating"]);
    expect(apply).toHaveBeenCalledOnce();
  });
  it("applies when only the offline worker has a new version", async () => {
    const apply = vi.fn(async () => {});
    await runUpdateApp(() => {}, { check: async () => ({ status: "up-to-date", published: [] }), refresh: async () => true, apply });
    expect(apply).toHaveBeenCalledOnce();
  });
  it("says already up to date, offline or failed without reloading", async () => {
    for (const status of ["up-to-date", "offline", "failed"] as const) {
      const { s, on } = states();
      const apply = vi.fn(async () => {});
      const published = status === "up-to-date" ? ["/assets/index-A.js"] : [];
      await runUpdateApp(on, { check: async () => ({ status, published }), refresh: async () => false, apply });
      expect(s).toEqual(["checking", status]);
      expect(apply).not.toHaveBeenCalled();
    }
  });
  it("labels", () => {
    expect(updateButtonLabel("idle")).toBe("Update app");
    expect(updateButtonLabel("checking")).toBe("Checking…");
    expect(updateButtonLabel("up-to-date")).toBe("Already up to date");
  });
});


  it("applies on an explicit tap when the published fingerprint cannot be read", async () => {
    const apply = vi.fn(async () => {});
    const out = await runUpdateApp(() => {}, { check: async () => ({ status: "up-to-date", published: [] }), refresh: async () => false, apply });
    expect(out).toBe("updating");
    expect(apply).toHaveBeenCalledOnce();
  });
  it("reads a published build id", () => {
    expect(publishedBuild({ build: "abc" })).toBe("abc");
    expect(publishedBuild({})).toBe("");
  });
  it("compares /app-version.json with the running build", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ build: "new" }), { status: 200 })) as unknown as typeof fetch;
    expect((await checkForAppUpdate({ fetchImpl: f, online: true, runningBuild: "old" })).status).toBe("update-available");
    expect((await checkForAppUpdate({ fetchImpl: f, online: true, runningBuild: "new" })).status).toBe("up-to-date");
  });
describe("app update: apply", () => {
  beforeEach(() => sessionStorage.clear());
  it("drops only old saved pages, keeps offline lessons and media, flags and reloads", async () => {
    const deleted: string[] = [];
    vi.stubGlobal("caches", {
      keys: async () => ["academia-pages", "academia-shell", "academia-media", "academia-pack"],
      delete: async (n: string) => { deleted.push(n); return true; },
    });
    const reload = vi.fn();
    await applyAppUpdate(reload);
    expect(deleted).toEqual(["academia-pages"]);
    expect(reload).toHaveBeenCalledOnce();
    expect(takeUpdatedFlag()).toBe(true);
    expect(takeUpdatedFlag()).toBe(false);
    vi.unstubAllGlobals();
  });
  it("ignores an old flag", () => {
    sessionStorage.setItem(UPDATED_FLAG_KEY, String(Date.now() - 5 * 60_000));
    expect(takeUpdatedFlag()).toBe(false);
  });
});
