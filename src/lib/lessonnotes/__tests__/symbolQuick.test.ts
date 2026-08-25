import { describe, expect, it } from "vitest";
import { SYMBOL_CATEGORIES, filterSymbolCategories } from "../symbolQuick";

describe("symbol quick access", () => {
  it("keeps the fixed priority order", () => {
    expect(SYMBOL_CATEGORIES.map((c) => c.id)).toEqual([
      "core", "greek", "algebra", "number", "trig", "geometry",
      "coord", "stats", "calculus", "sets", "logs",
    ]);
  });

  it("never contains matrix", () => {
    const blob = JSON.stringify(SYMBOL_CATEGORIES).toLowerCase();
    expect(blob.includes("matrix")).toBe(false);
  });

  it("every item is insertable", () => {
    for (const c of SYMBOL_CATEGORIES) {
      expect(c.items.length).toBeGreaterThan(0);
      for (const it of c.items) {
        if (it.kind === "text") expect(it.value.length).toBeGreaterThan(0);
        else expect(it.structure.length).toBeGreaterThan(0);
      }
    }
  });

  it("filters without reordering categories", () => {
    const res = filterSymbolCategories("θ");
    expect(res.length).toBeGreaterThan(0);
    const order = SYMBOL_CATEGORIES.map((c) => c.id);
    const got = res.map((c) => c.id);
    expect(got).toEqual(order.filter((id) => got.includes(id)));
  });
});
