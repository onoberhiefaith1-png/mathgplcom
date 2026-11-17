// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  applyAppUpdate, checkForAppUpdate, deleteStaleCaches, entryAssets, isNewerBuild,
  liveReloadUrl, publishedBuild, publishedEntry, runUpdateApp, shouldKeepCache,
  shortBuildId, takeUpdatedFlag, updateButtonLabel, APP_VERSION_API, APP_VERSION_URL,
  RELOAD_PARAM, UPDATED_FLAG_KEY,
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
  it("asks the network, bypassing caches, with a cache-busting query", async () => {
    const f = html("/assets/index-A.js");
    await checkForAppUpdate({ fetchImpl: f, online: true, loaded: ["/assets/index-A.js"], runningBuild: "dev" });
    const calls = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls[0]![0].startsWith(APP_VERSION_API + "?__update_check=")).toBe(true);
    expect(calls.some(([url]) => url.startsWith(`${APP_VERSION_URL}?__update_check=`))).toBe(true);
    expect(calls.some(([url]) => /^\/\?__update_check=\d+$/.test(url))).toBe(true);
    expect(calls[0]![1].cache).toBe("no-store");
    expect((calls[0]![1].headers as Record<string, string>)["Cache-Control"]).toBe("no-cache");
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
  it("reads a published build id and compares it with the running build", async () => {
    expect(publishedBuild({ build: "abc" })).toBe("abc");
    expect(publishedBuild({})).toBe("");
    const f = vi.fn(async () => new Response(JSON.stringify({ build: "new" }), { status: 200 })) as unknown as typeof fetch;
    expect((await checkForAppUpdate({ fetchImpl: f, online: true, runningBuild: "old" })).status).toBe("update-available");
    expect((await checkForAppUpdate({ fetchImpl: f, online: true, runningBuild: "new" })).status).toBe("up-to-date");
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
  it("on a manual tap, always reloads when online even if the fingerprint matches", async () => {
    const apply = vi.fn(async () => {});
    const out = await runUpdateApp(() => {}, {
      mode: "manual",
      check: async () => ({ status: "up-to-date", published: ["same"] }),
      refresh: async () => false,
      apply,
    });
    expect(out).toBe("updating");
    expect(apply).toHaveBeenCalledOnce();
  });
  it("auto-check does not reload when already up to date", async () => {
    const apply = vi.fn(async () => {});
    const { s, on } = states();
    const out = await runUpdateApp(on, {
      mode: "auto",
      check: async () => ({ status: "up-to-date", published: ["same"] }),
      refresh: async () => false,
      apply,
    });
    expect(out).toBe("up-to-date");
    expect(s).toEqual(["checking", "up-to-date"]);
    expect(apply).not.toHaveBeenCalled();
  });
  it("auto-check applies when only the offline worker has a new version", async () => {
    const apply = vi.fn(async () => {});
    await runUpdateApp(() => {}, { mode: "auto", check: async () => ({ status: "up-to-date", published: ["same"] }), refresh: async () => true, apply });
    expect(apply).toHaveBeenCalledOnce();
  });
  it("says offline or failed without reloading", async () => {
    for (const status of ["offline", "failed"] as const) {
      const { s, on } = states();
      const apply = vi.fn(async () => {});
      await runUpdateApp(on, { check: async () => ({ status, published: [] }), refresh: async () => false, apply });
      expect(s).toEqual(["checking", status]);
      expect(apply).not.toHaveBeenCalled();
    }
  });
  it("labels", () => {
    expect(updateButtonLabel("idle")).toBe("Update app");
    expect(updateButtonLabel("checking")).toBe("Checking…");
    expect(updateButtonLabel("updating")).toBe("Updating…");
    expect(updateButtonLabel("up-to-date")).toBe("Up to date");
    expect(updateButtonLabel("failed")).toBe("Couldn't check. Try again");
    expect(shortBuildId("1794936006478")).toBe("179493600647");
    expect(shortBuildId("dev")).toBe("dev");
  });
});

describe("app update: apply", () => {
  beforeEach(() => sessionStorage.clear());
  it("drops HTML and JS caches, keeps lesson media and packs, and hard-reloads a cache-busted URL", async () => {
    const deleted: string[] = [];
    vi.stubGlobal("caches", {
      keys: async () => ["academia-pages", "academia-shell", "academia-media", "academia-pack", "workbox-precache-v2"],
      delete: async (n: string) => { deleted.push(n); return true; },
    });
    const reload = vi.fn();
    const unregister = vi.fn(async () => 1);
    const clearWebCache = vi.fn(async () => {});
    const androidClear = vi.fn();
    await applyAppUpdate(reload, {
      unregister,
      desktop: { clearWebCache },
      android: { clearCache: androidClear },
      href: "/academia-app?__v=99",
    });
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleted.sort()).toEqual(["academia-pages", "academia-shell", "workbox-precache-v2"]);
    expect(deleted).not.toContain("academia-media");
    expect(deleted).not.toContain("academia-pack");
    expect(clearWebCache).toHaveBeenCalledOnce();
    expect(androidClear).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledWith("/academia-app?__v=99");
    expect(takeUpdatedFlag()).toBe(true);
    expect(takeUpdatedFlag()).toBe(false);
    vi.unstubAllGlobals();
  });
  it("builds a cache-busted URL without dropping other query params or the hash", () => {
    expect(liveReloadUrl({ pathname: "/academia-app", search: "?install=1&__v=old", hash: "#home" }, 42))
      .toBe(`/academia-app?install=1&${RELOAD_PARAM}=42#home`);
  });
  it("does not delete lesson caches", () => {
    expect(shouldKeepCache("academia-media")).toBe(true);
    expect(shouldKeepCache("academia-pack")).toBe(true);
    expect(shouldKeepCache("academia-shell")).toBe(false);
  });
  it("deleteStaleCaches skips keep-list names", async () => {
    const deleted: string[] = [];
    const store = {
      keys: async () => ["academia-pages", "academia-media", "academia-pack"],
      delete: async (n: string) => { deleted.push(n); return true; },
    };
    await deleteStaleCaches(store);
    expect(deleted).toEqual(["academia-pages"]);
  });
  it("ignores an old flag", () => {
    sessionStorage.setItem(UPDATED_FLAG_KEY, String(Date.now() - 5 * 60_000));
    expect(takeUpdatedFlag()).toBe(false);
  });
  it("does not touch localStorage, cookies or a mock IndexedDB when applying", async () => {
    localStorage.setItem("keep-me", "yes");
    document.cookie = "session=abc";
    const idb = { deleteDatabase: vi.fn() };
    vi.stubGlobal("indexedDB", idb);
    vi.stubGlobal("caches", { keys: async () => [], delete: async () => true });
    await applyAppUpdate(() => {}, { unregister: async () => 0, href: "/x" });
    expect(localStorage.getItem("keep-me")).toBe("yes");
    expect(document.cookie).toContain("session=abc");
    expect(idb.deleteDatabase).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
