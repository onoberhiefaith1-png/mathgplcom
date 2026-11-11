// A power must never grow a phantom subscript, and filling an exponent hands
// the caret straight back to the baseline (Game sensor and Smartboard caret).
import { describe, expect, it } from "vitest";
import {
  exitFilledScriptAfterInsert, insertChar, isPhantomScriptSlot, mkChar, mkPower, mkSubSup,
  moveDown, moveLeft, moveRight, type Node, type Row,
} from "../mathTree";
import { emptySlotCursors, gameMoveVertical, newSlotEntry } from "../gameSensor";
import { mirrorLessonNoteRow } from "../mirrorFromLessonNote";
import { insertMirroredRow } from "../insertMirroredRow";
import { rowToAscii } from "../rowAscii";

const squared = (): Row => {
  const m = mirrorLessonNoteRow("x^{2}");
  expect(m.ok).toBe(true);
  return m.row;
};

describe("power caret", () => {
  it("a mirrored x² is a subsup whose empty subscript is a phantom, not a slot", () => {
    const row = squared();
    expect(row[0].kind).toBe("subsup");
    expect(isPhantomScriptSlot(row[0], 1)).toBe(true);
    expect(emptySlotCursors(row)).toEqual([]);
  });

  it("placing x² never auto-enters a subscript", () => {
    expect(newSlotEntry([mkChar("3"), mkChar("+")], [mkChar("3"), mkChar("+"), ...squared()])).toBeNull();
  });

  it("the Game ↓ key never drops into a subscript that does not exist", () => {
    const row = squared();
    // Sensor right after x²: ↓ has nowhere to go.
    expect(gameMoveVertical(row, { path: [], index: 1 }, 1)).toBeNull();
    // From the base, ↓ steps out onto the baseline — never into a subscript.
    expect(gameMoveVertical(row, { path: [0, 0], index: 1 }, 1)?.path).toEqual([]);
    // From the exponent, ↓ leaves the power on the baseline (never the sub).
    const down = gameMoveVertical(row, { path: [0, 2], index: 1 }, 1);
    expect(down?.path).not.toEqual([0, 1]);
    // Smartboard ↓ from the base has no slot below.
    expect(moveDown(row, { path: [0, 0], index: 1 })).toBeNull();
  });

  it("→ from the base goes to the exponent, and ← from the exponent back to the base", () => {
    const row = squared();
    expect(moveRight(row, { path: [0, 0], index: 1 })).toEqual({ path: [0, 2], index: 0 });
    expect(moveLeft(row, { path: [0, 2], index: 0 })).toEqual({ path: [0, 0], index: 1 });
  });

  it("a fresh □_□^□ structure keeps both of its real slots", () => {
    const shell: Node = mkSubSup();
    expect(isPhantomScriptSlot(shell, 1)).toBe(false);
    expect(isPhantomScriptSlot(shell, 2)).toBe(false);
    expect(emptySlotCursors([shell]).length).toBe(3);
  });

  it("typing the exponent returns the caret just after the power, on the baseline", () => {
    // x^□ with the caret in the exponent.
    const power = mkPower() as Extract<Node, { kind: "power" }>;
    power.rows = [[mkChar("x")], []];
    let root: Row = [power];
    const typed = insertChar(root, { path: [0, 1], index: 0 }, "2");
    root = typed.root;
    const cursor = exitFilledScriptAfterInsert(root, typed.cursor);
    expect(cursor).toEqual({ path: [], index: 1 });
    root = insertChar(root, cursor, "+").root;
    expect(rowToAscii(root)).toBe("(x)^(2)+");
  });

  it("a Floating Number dropped into an exponent also returns to the baseline", () => {
    const power = mkPower() as Extract<Node, { kind: "power" }>;
    power.rows = [[mkChar("x")], []];
    const res = insertMirroredRow([power], { path: [0, 1], index: 0 }, mirrorLessonNoteRow("2").row);
    expect(exitFilledScriptAfterInsert(res.root, res.cursor)).toEqual({ path: [], index: 1 });
  });

  it("the caret stays put while it is still mid-exponent or outside any script", () => {
    const power = mkPower() as Extract<Node, { kind: "power" }>;
    power.rows = [[mkChar("x")], [mkChar("1"), mkChar("0")]];
    const mid = { path: [0, 1], index: 1 };
    expect(exitFilledScriptAfterInsert([power], mid)).toBe(mid);
    const base = { path: [0, 0], index: 1 };
    expect(exitFilledScriptAfterInsert([power], base)).toBe(base);
  });
});
