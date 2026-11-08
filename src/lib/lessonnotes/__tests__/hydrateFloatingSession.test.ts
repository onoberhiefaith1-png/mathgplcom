// Board open path: SmartBoardPage waits for hydrateFloatingFromOrigin before
// mounting the board. Count requests per open and check cache freshness.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const updates: string[] = [];
let rows: Record<string, any> = {};
let failTable: string | null = null;
let failUpdate = false;
let user = "teacher-1";

vi.mock("@/integrations/supabase/client", () => {
  const q = (table: string) => {
    const st: any = { filters: {} };
    const result = () => {
      if (st.update) { updates.push(String(st.filters.id)); return { data: null, error: failUpdate ? { message: "rls" } : null }; }
      if (failTable === table) return { data: null, error: { message: "timeout" } };
      return { data: rows[table]?.(st.filters) ?? null, error: null };
    };
    const o: any = {
      select: () => o,
      eq: (k: string, v: unknown) => { st.filters[k] = v; return o; },
      in: (k: string, v: unknown) => { st.filters[k] = v; return o; },
      update: () => { st.update = true; return o; },
      maybeSingle: async () => { calls.push(table); return result(); },
      then: (res: any) => { calls.push(table + (st.update ? ":update" : "")); return Promise.resolve(result()).then(res); },
    };
    return o;
  };
  return { supabase: { from: q, auth: { getSession: async () => ({ data: { session: { user: { id: user } } } }) } } };
});

const mod = await import("@/lib/lessonnotes/hydrateFloatingFromOrigin");

const unprepared = (id: string, doc_key: string) => ({ id, doc_key, floating_lines: [], floating_highlights: [], floating_bucket: null });
let originRows: any[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  calls.length = 0; updates.length = 0; failTable = null; failUpdate = false; user = "teacher-1";
  mod.resetFloatingHydrationMemo();
  originRows = [{ id: "o1", doc_key: "k1", floating_lines: [{ fillers: ["2"] }] }];
  rows = {
    notebooks: () => ({ id: "copy", origin_notebook_id: "orig" }),
    notebook_sections: (f: any) => [{ id: f.notebook_id === "copy" ? "s-copy" : "s-orig" }],
    notebook_subsections: (f: any) => (f.section_id?.[0] === "s-copy"
      ? [unprepared("t1", "k1"), unprepared("t2", "k2")].filter((r) => !updates.includes(r.id))
          .concat(updates.map((id) => ({ ...unprepared(id, id === "t1" ? "k1" : "k2"), floating_lines: [{ fillers: ["x"] }] })))
      : originRows),
    notebook_blocks: () => [],
  };
});
afterEach(() => vi.useRealTimers());

const opens = () => calls.filter((c) => c === "notebooks").length;

describe("hydrateFloatingFromOrigin per open", () => {
  it("a clean check is reused only inside the TTL, then revalidates", async () => {
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(1);
    const n = calls.length;
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(0);
    expect(calls.length).toBe(n); // quick reopen: no requests
    vi.advanceTimersByTime(mod.HYDRATION_TTL_MS + 1);
    await mod.hydrateFloatingFromOrigin("copy");
    expect(opens()).toBe(2);
  });

  it("origin prepared later in the same session is picked up after the window, no reload", async () => {
    originRows = [];
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(0);
    originRows = [{ id: "o1", doc_key: "k1", floating_lines: [{ fillers: ["2"] }] }, { id: "o2", doc_key: "k2", floating_lines: [{ fillers: ["3"] }] }];
    vi.advanceTimersByTime(mod.HYDRATION_TTL_MS + 1);
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(2);
  });

  it("explicit invalidation re-checks immediately", async () => {
    await mod.hydrateFloatingFromOrigin("copy");
    mod.invalidateFloatingHydration("copy");
    await mod.hydrateFloatingFromOrigin("copy");
    expect(opens()).toBe(2);
  });

  it("a read error is not cached and retries on the next open", async () => {
    failTable = "notebook_subsections";
    await expect(mod.hydrateFloatingFromOrigin("copy")).rejects.toThrow("timeout");
    failTable = null;
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(1);
  });

  it("a failed write is not cached and retries on the next open", async () => {
    failUpdate = true;
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(0);
    failUpdate = false;
    updates.length = 0;
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(1);
    expect(updates).toEqual(["t1"]);
  });

  it("concurrent opens share one run", async () => {
    const [a, b] = await Promise.all([mod.hydrateFloatingFromOrigin("copy"), mod.hydrateFloatingFromOrigin("copy")]);
    expect([a, b]).toEqual([1, 1]);
    expect(opens()).toBe(1);
  });

  it("another signed-in user never reuses the cache", async () => {
    await mod.hydrateFloatingFromOrigin("copy");
    user = "teacher-2";
    await mod.hydrateFloatingFromOrigin("copy");
    expect(opens()).toBe(2);
  });

  it("an original notebook loads no carrier rows", async () => {
    rows.notebooks = () => ({ id: "copy", origin_notebook_id: null });
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(0);
    expect(calls).toEqual(["notebooks"]);
  });
});
