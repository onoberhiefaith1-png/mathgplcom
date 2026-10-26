/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { chunk, ID_CHUNK, PAGE_SIZE, selectAll } from "../packQuery";

/** A tiny PostgREST stand-in: filters by `in`, honours `range`, records every request. */
function fakeDb(rows: Record<string, unknown>[], opts: { fail?: boolean } = {}) {
  const calls: { ids: string[]; from: number; to: number; orders: string[] }[] = [];
  return {
    calls,
    db: { from: () => {
      let ids: string[] = []; const orders: string[] = []; let found = rows;
      const q: any = {
        select: () => q,
        in: (column: string, values: string[]) => { ids = values; found = rows.filter((r) => values.includes(r[column] as string)); return q; },
        order: (column: string) => { orders.push(column); return q; },
        range: (from: number, to: number) => {
          calls.push({ ids, from, to, orders });
          const page = found.slice(from, to + 1);
          // PostgREST never returns more than 1000 rows, whatever range was asked for.
          return Promise.resolve({ data: page.slice(0, 1000), error: opts.fail ? { message: "boom" } : null });
        },
      };
      return q;
    } },
  };
}

describe("paged pack queries", () => {
  it("returns every row of a set larger than the 1000-row cap, across pages", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}`, activity_id: "a", n: i }));
    const { db, calls } = fakeDb(rows);
    const out = await selectAll(db, "academia_mcq_items", "*", "activity_id", ["a"]);
    expect(PAGE_SIZE).toBe(1000);
    expect(out).toHaveLength(2500);
    expect(new Set(out.map((r) => r.id)).size).toBe(2500);
    expect(calls.map((c) => [c.from, c.to])).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("stops after one request when the set is under the cap, ordered by position then id", async () => {
    const { db, calls } = fakeDb([{ id: "x", activity_id: "a" }]);
    expect(await selectAll(db, "t", "*", "activity_id", ["a"])).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.orders).toEqual(["position", "id"]);
  });

  it("asks for exactly one extra empty page when a set is an exact multiple of the page size", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, activity_id: "a" }));
    const { db, calls } = fakeDb(rows);
    expect(await selectAll(db, "t", "*", "activity_id", ["a"])).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it("splits long id lists into chunks and merges the results", async () => {
    const ids = Array.from({ length: ID_CHUNK * 2 + 10 }, (_, i) => `id${i}`);
    const rows = ids.map((id) => ({ id, parent: id }));
    const { db, calls } = fakeDb(rows);
    const out = await selectAll(db, "t", "*", "parent", ids, null);
    expect(out).toHaveLength(ids.length);
    expect(calls.map((c) => c.ids.length)).toEqual([ID_CHUNK, ID_CHUNK, 10]);
    expect(calls[0]!.orders).toEqual(["id"]);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("makes no request for an empty id list and drops duplicate ids", async () => {
    const { db, calls } = fakeDb([]);
    expect(await selectAll(db, "t", "*", "id", [])).toEqual([]);
    await selectAll(db, "t", "*", "id", ["a", "a", "b"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.ids).toEqual(["a", "b"]);
  });

  it("fails loudly rather than returning a partial set", async () => {
    const { db } = fakeDb([{ id: "a" }], { fail: true });
    await expect(selectAll(db, "academia_activities", "*", "id", ["a"])).rejects.toThrow("academia-pack academia_activities: boom");
  });
});
