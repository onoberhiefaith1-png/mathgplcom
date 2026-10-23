import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ saved: null as any, writes: [] as string[], slow: false, progress: null as any }));
vi.mock("@/lib/offline/academiaStore", () => ({
  getCatalogue: async () => state.saved,
  getKv: vi.fn(), setKv: async (key: string) => { state.writes.push(key); },
  saveCatalogue: async (catalogue: unknown) => { state.saved = catalogue; },
}));
vi.mock("@/lib/offline/prepareOffline", () => ({
  prepareOffline: async (_schools: unknown, progress: unknown) => { state.progress = progress; return state.slow ? new Promise(() => {}) : { state: "ready", skipped: 0 }; }, downloadVideosInBackground: vi.fn(),
}));
import { getReady } from "../getReady";
beforeEach(() => { state.saved = { schema: 5, version: "saved", schools: [{ id: "school" }] }; state.writes = []; state.slow = false; state.progress = null; });
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

it("ignores late media progress after the deadline so Ready cannot turn back into loading", async () => {
  vi.useFakeTimers(); state.slow = true;
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ schema: 6, version: "new", schools: [{ id: "school" }] }) }));
  const progress = vi.fn();
  try {
    const result = getReady(["school"], progress);
    await vi.advanceTimersByTimeAsync(46_000);
    expect((await result).ok).toBe(true);
    expect(progress).toHaveBeenLastCalledWith(100);
    const calls = progress.mock.calls.length;
    state.progress({ state: "working", done: 10, total: 10 });
    expect(progress).toHaveBeenCalledTimes(calls);
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
});
