import { describe, expect, it } from "vitest";
import { mkBracket, mkChar, mkPower, type Row } from "@/lib/smartboard/mathTree";
import { rowToGameMirror, SENSOR_GLYPH } from "@/lib/smartboard/rowCaret";
import { rowToAscii } from "@/lib/smartboard/rowAscii";

describe("game mirror", () => {
  it("shows an empty bracket slot as a placeholder box", () => {
    const row: Row = [mkChar("2"), mkBracket("(", ")")];
    expect(rowToAscii(row)).toBe("2()");
    expect(rowToGameMirror(row)).toBe("2(□)");
  });

  it("draws the sensor inside the bracket body when the cursor is there", () => {
    const row: Row = [mkChar("2"), mkBracket("(", ")")];
    const mirror = rowToGameMirror(row, { path: [1, 0], index: 0 });
    expect(mirror).toBe(`2(${SENSOR_GLYPH}□)`);
  });

  it("draws the sensor in an exponent slot", () => {
    const row: Row = [mkPower()];
    const mirror = rowToGameMirror(row, { path: [0, 1], index: 0 });
    expect(mirror.includes(SENSOR_GLYPH)).toBe(true);
  });

  it("leaves filled working untouched apart from the sensor", () => {
    const row: Row = [mkChar("x"), mkChar("="), mkChar("5")];
    expect(rowToGameMirror(row, null)).toBe("x=5");
    expect(rowToGameMirror(row, { path: [], index: 3 })).toBe(`x=5${SENSOR_GLYPH}`);
  });
});
