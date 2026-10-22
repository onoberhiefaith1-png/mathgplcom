import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ saved: null as any, writes: [] as string[] }));
vi.mock("@/lib/offline/academiaStore", () => ({
  getCatalogue: async () => state.saved,
  getKv: vi.fn(), setKv: async (key: string) => { state.writes.push(key); },
  saveCatalogue: async (catalogue: unknown) => { state.saved = catalogue; },
}));
vi.mock("@/lib/offline/prepareOffline", () => ({
  prepareOffline: async () => ({ state: "ready", skipped: 0 }), downloadVideosInBackground: vi.fn(),
}));
import { getReady } from "../getReady";
beforeEach(() => { state.saved = { schema: 5, version: "saved", schools: [{ id: "school" }] }; state.writes = []; });
it("upgrades the catalogue without clearing any progress or school selection", async () => {
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ schema: 6, version: "new", schools: [{ id: "school" }] }) }));
  const result = await getReady(["school"], vi.fn());
  expect(result.ok).toBe(true);
  expect(state.saved.schema).toBe(6);
  expect(state.writes).toEqual(["readyAt.v5"]);
  vi.unstubAllGlobals();
});
it("keeps the saved copy if the server still returns an older format", async () => {
  const saved = state.saved;
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ schema: 5, schools: [] }) }));
  expect((await getReady(["school"], vi.fn())).ok).toBe(false);
  expect(state.saved).toBe(saved);
  expect(state.writes).toEqual([]);
  vi.unstubAllGlobals();
});
