import { describe, expect, it } from "vitest";
import { mkBracket, mkChar, mkPower } from "../mathTree";
import { emptySlotCursors, newSlotEntry } from "../gameSensor";

describe("Game sensor auto-entry", () => {
  it("enters a bracket slot the moment it appears", () => {
    const prev = [mkChar("2")];
    const next = [mkChar("2"), mkBracket("(", ")")];
    expect(newSlotEntry(prev, next)).toEqual({ path: [1, 0], index: 0 });
  });
  it("does nothing when no new slot exists", () => {
    const row = [mkChar("2"), mkBracket("(", ")")];
    expect(newSlotEntry(row, row)).toBeNull();
    expect(newSlotEntry([], [mkChar("3")])).toBeNull();
  });
  it("reaches a second slot further along the line", () => {
    const prev = [mkBracket("(", ")")];
    const next = [mkBracket("(", ")"), mkChar("+"), mkPower()];
    expect(newSlotEntry(prev, next)?.path[0]).toBe(2);
    expect(emptySlotCursors(next).length).toBe(3);
  });
});
