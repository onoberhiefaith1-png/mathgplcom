import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normEq } from "@/lib/smartboard/rowAscii";
import { completionCandidates, PreClearedLines, requestPreClearance } from "../preClear";
import { predict, routeMapFor } from "../predictiveLine";

const has = (list: string[], v: string) => list.map(normEq).includes(normEq(v));

describe("pre-evaluation follows the predictive route", () => {
  it("a student who starts A = 2 from '2' has '2 = A' pre-evaluated", () => {
    const cands = completionCandidates({ studentAscii: "2", atoms: ["A", "=", "2"] });
    expect(has(cands, "2 = A")).toBe(true);
    // the predictive line shows the very same rerouted line
    expect(predict({ routeMap: routeMapFor({ expectedAscii: "A = 2", atoms: ["A", "=", "2"] }), studentAscii: "2" }).predictive).toBe("2 = A");
  });

  it("pre-evaluates the inside of a paired root, so the last value marks instantly", () => {
    const cands = completionCandidates({ studentAscii: "x = \\sqrt{b^2 - }", atoms: ["x", "=", "\\sqrt{}", "b^2", "-", "4ac"] });
    expect(has(cands, "x = \\sqrt{b^2 - 4ac}")).toBe(true);
  });

  it("uses the caret when the board reports it", () => {
    const student = "y = () + c";
    const cands = completionCandidates({ studentAscii: student, atoms: ["y", "=", "(□)", "a", "+", "c"], caret: student.indexOf(")") });
    expect(normEq(cands[1])).toBe(normEq("y = (a) + c"));
  });

  it("awards when the final expected value is written while the answer is pending", async () => {
    const store = new PreClearedLines();
    let board = "2 =";
    const marks: string[] = [];
    let release!: (v: string[]) => void;
    const p = requestPreClearance({
      store, slotKey: "q:l", candidates: completionCandidates({ studentAscii: board, atoms: ["A", "=", "2"] }),
      send: () => new Promise((r) => { release = r; }), isCurrent: () => true,
      onAccepted: () => { if (store.isCleared("q:l", board)) marks.push(board); },
    });
    board = "2 = A";
    release(["2 = A"]);
    await p;
    expect(marks).toEqual(["2 = A"]);
  });

  it("PresentationView sends the live caret with look-ahead candidates", () => {
    const src = readFileSync(resolve(__dirname, "../../../components/smartboard/PresentationView.tsx"), "utf8");
    expect(src).toMatch(/asciiWithCaret\(liveRow, cursor\)/);
    expect(src).toMatch(/limit: MAX_PRECLEAR_CANDIDATES, caret \}/);
  });
});
