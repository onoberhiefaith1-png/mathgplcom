import { afterEach, expect, it, vi } from "vitest";
import { mediaToSave, resumeMissingMedia } from "../prepareOffline";
import { CASTLE_URL, GAME_FONT_URLS } from "@/lib/academia/offlineLook";
import type { PackSchool } from "../academiaStore";

const school = (game: unknown): PackSchool => ({
  id: "s", name: "S", classes: [{ id: "c", name: "C", subjects: [{ id: "u", name: "U", topics: [{ id: "t", name: "T", subtopics: [{ id: "st", name: "ST", sessions: [{
    id: "se", name: "Se", activities: [{ id: "a", kind: "adventure", game: { game, assetUrls: {} }, adventure: { canvas: { video: { path: "https://x.test/api/public/academia-media?activity=a&adventureAsset=v.mp4", source: "url" }, narrations: [] }, audio: {}, assetUrls: {}, game, questions: [] } }],
  }] }] }] }] }],
}) as unknown as PackSchool;

afterEach(() => vi.unstubAllGlobals());

it("saves the castle, fonts and the Game's surface frames under their plain addresses", () => {
  const urls = mediaToSave([school({ surfaceId: "wood", slots: [] })]);
  expect(urls).toContain(CASTLE_URL);
  for (const font of GAME_FONT_URLS) expect(urls).toContain(font);
  expect(urls).toContain("/offline-game/surfaces/wood.webp");
  expect(urls.some((u) => u.includes("adventureAsset=v.mp4") && u.includes("_aof=1"))).toBe(true);
});

it("resume saves only what is missing and never replaces a saved file", async () => {
  const store = new Map<string, unknown>();
  const wanted = mediaToSave([school({ surfaceId: "wood" })]).filter((u) => !/\.(mp4)(\?|&|$)/.test(decodeURIComponent(u)));
  store.set(wanted[0]!, "saved-copy");
  const cache = { match: async (u: string) => (store.has(u) ? store.get(u) : undefined), put: async (u: string, r: unknown) => { store.set(u, r); } };
  vi.stubGlobal("caches", { open: async () => cache });
  vi.stubGlobal("navigator", { onLine: true });
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), body: null }));
  vi.stubGlobal("fetch", fetchMock);
  await resumeMissingMedia([school({ surfaceId: "wood" })]);
  expect(store.get(wanted[0]!)).toBe("saved-copy");
  expect((fetchMock.mock.calls as unknown[][]).map((c) => c[0])).not.toContain(wanted[0]);
  expect(fetchMock.mock.calls.length).toBeGreaterThan(5);
});

it("does nothing offline", async () => {
  vi.stubGlobal("caches", { open: vi.fn() });
  vi.stubGlobal("navigator", { onLine: false });
  expect(await resumeMissingMedia([school({})])).toBe(0);
});
