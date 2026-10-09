import { describe, it, expect, vi } from "vitest";
import * as model from "../model";

describe("itemsForObjects", () => {
  const items = [{ id: "pyth" }, { id: "only-ac" }] as any[];
  const refs: Record<string, string[]> = { pyth: ["AC", "BC", "AB"], "only-ac": ["AC"] };
  vi.spyOn(model, "itemObjectIds").mockImplementation((i: any) => refs[i.id]);
  it("keeps only properties linking every tapped part", () => {
    const r = model.itemsForObjects(items, ["AC", "BC"]).map((i) => i.id);
    expect(r).toEqual(["pyth"]);
  });
  it("toggles a part off when tapped again", () => {
    expect(model.toggleObjectSelection(["AC", "BC"], "AC")).toEqual(["BC"]);
  });
});
