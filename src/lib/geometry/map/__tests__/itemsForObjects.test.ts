import { describe, it, expect } from "vitest";
import { itemsForObjects, toggleObjectSelection } from "../model";

describe("itemsForObjects", () => {
  const items = [
    { id: "pyth", objectIds: ["AC", "BC", "AB"] },
    { id: "only-ac", objectIds: ["AC"] },
  ] as any[];
  it("keeps only properties linking every tapped part", () => {
    expect(itemsForObjects(items, ["AC", "BC"]).map((i) => i.id)).toEqual(["pyth"]);
  });
  it("is blank when nothing links all tapped parts", () => {
    expect(itemsForObjects(items, ["AC", "BC", "XY"])).toEqual([]);
  });
  it("toggles a part off when tapped again", () => {
    expect(toggleObjectSelection(["AC", "BC"], "AC")).toEqual(["BC"]);
  });
});
