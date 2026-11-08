// Board open path: SmartBoardPage waits for hydrateFloatingFromOrigin before
// mounting the board. Count the database round trips it costs per open.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const updates: string[] = [];
let rows: Record<string, any> = {};

vi.mock("@/integrations/supabase/client", () => {
  const q = (table: string) => {
    const state: any = { table, filters: {} as Record<string, unknown> };
    const o: any = {
      select: () => o,
      eq: (k: string, v: unknown) => { state.filters[k] = v; return o; },
      in: (k: string, v: unknown) => { state.filters[k] = v; return o; },
      update: (_: unknown) => { state.update = true; return o; },
      maybeSingle: async () => { calls.push(table); return { data: rows[table]?.(state.filters), error: null }; },
      then: (res: any) => {
        calls.push(table + (state.update ? ":update" : ""));
        if (state.update) updates.push(String(state.filters.id));
        return Promise.resolve({ data: state.update ? null : rows[table]?.(state.filters) ?? [], error: null }).then(res);
      },
    };
    return o;
  };
  return { supabase: { from: (t: string) => q(t) } };
});

const mod = await import("@/lib/lessonnotes/hydrateFloatingFromOrigin");

beforeEach(() => {
  calls.length = 0; updates.length = 0; mod.resetFloatingHydrationMemo();
  rows = {
    notebooks: () => ({ id: "copy", origin_notebook_id: "orig" }),
    notebook_sections: (f: any) => [{ id: f.notebook_id === "copy" ? "s-copy" : "s-orig" }],
    notebook_subsections: (f: any) => (f.section_id?.[0] === "s-copy"
      ? [{ id: "t1", doc_key: "k1", floating_lines: [], floating_highlights: [], floating_bucket: null }, { id: "t2", doc_key: "k2", floating_lines: [], floating_highlights: [], floating_bucket: null }, { id: "t3", doc_key: "none", floating_lines: [], floating_highlights: [], floating_bucket: null }]
      : [{ id: "o1", doc_key: "k1", floating_lines: [{ fillers: ["2"] }] }, { id: "o2", doc_key: "k2", floating_lines: [{ fillers: ["3"] }] }]),
    notebook_blocks: () => [],
  };
});

describe("hydrateFloatingFromOrigin per open", () => {
  it("fills unprepared copy rows once (parallel writes) and costs nothing on reopen", async () => {
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(2);
    expect(updates.sort()).toEqual(["t1", "t2"]);
    const first = calls.length;
    expect(first).toBe(1 + 3 + 3 + 2);
    // t3 can never be prepared (origin has no match): before the memo every
    // reopen repeated the whole 1+3+3 query chain before the board mounted.
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(0);
    expect(calls.length).toBe(first);
  });

  it("concurrent opens share one run", async () => {
    const [a, b] = await Promise.all([mod.hydrateFloatingFromOrigin("copy"), mod.hydrateFloatingFromOrigin("copy")]);
    expect([a, b]).toEqual([2, 2]);
    expect(updates).toHaveLength(2);
  });

  it("an original notebook still needs no origin rows", async () => {
    rows.notebooks = () => ({ id: "copy", origin_notebook_id: null });
    expect(await mod.hydrateFloatingFromOrigin("copy")).toBe(0);
    expect(calls.filter((c) => c === "notebook_subsections")).toHaveLength(1);
    expect(updates).toHaveLength(0);
  });
});
