import { describe, expect, it } from "vitest";
import { mkChar, mkPower, mkSub, type Row } from "@/lib/smartboard/mathTree";
import { canGameMoveVertical, gameMoveVertical } from "@/lib/smartboard/gameSensor";
import { rowToGameMirror } from "@/lib/smartboard/rowCaret";

const chars = (s: string): Row => Array.from(s).map(mkChar);

describe("game sensor — vertical navigation", () => {
  it("is inert on a plain baseline position", () => {
    const row = chars("S+7");
    const cursor = { path: [] as number[], index: 2 };
    expect(canGameMoveVertical(row, cursor, -1)).toBe(false);
    expect(canGameMoveVertical(row, cursor, 1)).toBe(false);
    expect(gameMoveVertical(row, cursor, -1)).toBeNull();
  });

  it("enters an exponent slot and returns to the baseline", () => {
    const power = mkPower();
    (power as { rows: Row[] }).rows = [chars("12"), []];
    const row: Row = [power];
    const atPower = { path: [] as number[], index: 1 };
    expect(canGameMoveVertical(row, atPower, -1)).toBe(true);
    const inExp = gameMoveVertical(row, atPower, -1)!;
    expect(inExp.path).toEqual([0, 1]);

    const back = gameMoveVertical(row, inExp, 1)!;
    expect(back.path).toEqual([0, 0]); // exponent → base
    // ↑ from the exponent never escapes the structure.
    expect(gameMoveVertical(row, inExp, -1)).toBeNull();
  });

  it("enters a subscript slot only downwards", () => {
    const sub = mkSub();
    const row: Row = [...chars("x"), sub];
    const at = { path: [] as number[], index: 2 };
    expect(canGameMoveVertical(row, at, 1)).toBe(true);
    expect(canGameMoveVertical(row, at, -1)).toBe(false);
    expect(gameMoveVertical(row, at, 1)!.path).toEqual([1, 0]);
  });
});

describe("game mirror — raised placeholders", () => {
  it("raises a filled exponent", () => {
    const power = mkPower();
    (power as { rows: Row[] }).rows = [chars("12"), chars("2")];
    expect(rowToGameMirror([power])).toBe("12²");
  });

  it("shows an empty exponent cell attached to its base", () => {
    const power = mkPower();
    (power as { rows: Row[] }).rows = [chars("12"), []];
    expect(rowToGameMirror([power])).toBe("12⁽□⁾");
  });

  it("lowers a subscript", () => {
    const sub = mkSub();
    (sub as { rows: Row[] }).rows = [chars("1")];
    expect(rowToGameMirror([...chars("x"), sub])).toBe("x₁");
  });

  it("falls back to plain form when the sensor sits in a script", () => {
    const power = mkPower();
    (power as { rows: Row[] }).rows = [chars("12"), []];
    const out = rowToGameMirror([power], { path: [0, 1], index: 0 });
    expect(out).toBe("12^(|□)");
  });
});
