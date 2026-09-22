import { describe, expect, it } from "vitest";
import {
  buildRouteMap,
  hasCompleteShape,
  predict,
  provesEquivalent,
  remainingAtoms,
} from "../predictiveLine";

const map = (expected: string, atoms: string[]) =>
  buildRouteMap({ expectedAscii: expected, atoms });

describe("predictive line engine", () => {
  const atoms = ["x", "+", "7", "=", "12"];
  const simple = map("x + 7 = 12", atoms);

  it("knows the whole target before the student starts", () => {
    const p = predict({ routeMap: simple, studentAscii: "" });
    expect(p.status).toBe("empty");
    expect(p.complete).toBe(false);
    expect(p.predictive.replace(/\s+/g, "")).toBe("x+7=12");
  });

  it("follows the teacher's order", () => {
    const p = predict({ routeMap: simple, studentAscii: "x" });
    expect(p.predictive.replace(/\s+/g, "")).toBe("x+7=12");
    expect(p.remaining.join("")).toBe("+7=12");
  });

  it("adapts when the student starts from another valid route", () => {
    const p = predict({ routeMap: simple, studentAscii: "7" });
    expect(p.status).toBe("incomplete");
    expect(provesEquivalent(simple.expected, p.predictive)).toBe(true);
  });

  it("recognises the line from the other side", () => {
    const p = predict({ routeMap: simple, studentAscii: "12" });
    expect(provesEquivalent(simple.expected, p.predictive)).toBe(true);
  });

  it("completes the instant the final atom lands", () => {
    for (const written of ["x + 7 = 12", "7 + x = 12", "12 = x + 7"]) {
      const p = predict({ routeMap: simple, studentAscii: written });
      expect(p.complete).toBe(true);
      expect(p.status).toBe("complete");
      expect(p.remaining).toEqual([]);
    }
  });

  it("never completes a one-sided fragment of an equation line", () => {
    const p = predict({ routeMap: simple, studentAscii: "x + 7" });
    expect(p.complete).toBe(false);
    expect(hasCompleteShape("x + 7 = 12", "x + 7")).toBe(false);
  });

  it("rejects a construction that cannot reach the target", () => {
    const p = predict({ routeMap: simple, studentAscii: "x + 12 = 7" });
    expect(p.complete).toBe(false);
    expect(p.status).toBe("no_route");
  });

  it("reports no valid route when the remaining atoms cannot finish", () => {
    const short = map("x + 7 = 12", ["x", "+", "7"]);
    const p = predict({ routeMap: short, studentAscii: "x + 7" });
    expect(p.status).toBe("no_route");
  });

  it("keeps the expected line as destination for keyboard input", () => {
    const short = map("x + 7 = 12", ["x", "+", "7"]);
    const p = predict({ routeMap: short, studentAscii: "x + 7", allowFreeInput: true });
    expect(p.status).toBe("incomplete");
    expect(p.predictive).toBe("x + 7 = 12");
  });

  it("uses grouped Floating Numbers as single blocks", () => {
    const grouped = map("x + 7 = 12", ["x + 7", "=", "12"]);
    const p = predict({ routeMap: grouped, studentAscii: "x + 7" });
    expect(p.remaining).toEqual(["=", "12"]);
  });

  it("consumes only the atoms the student already placed", () => {
    expect(remainingAtoms(atoms, "x +")).toEqual(["7", "=", "12"]);
    expect(remainingAtoms(atoms, "")).toEqual(atoms);
  });

  it("restores equivalence on a rearranged partial line", () => {
    const complex = map("2(x + 3) - 4x + 5 = 11 - 2x", [
      "2(x + 3) - 4x + 5",
      "=",
      "11",
      "-",
      "2x",
    ]);
    const p = predict({ routeMap: complex, studentAscii: "11" });
    expect(provesEquivalent(complex.expected, p.predictive)).toBe(true);
  });
});

describe("predictive line re-routes from the student's own writing", () => {
  const atoms = ["x", "+7", "-7", "=", "12", "-7"];
  const step = buildRouteMap({ expectedAscii: "x + 7 - 7 = 12 - 7", atoms });

  it("starts as the expected line", () => {
    const p = predict({ routeMap: step, studentAscii: "" });
    expect(p.predictive.replace(/\s+/g, "")).toBe("x+7-7=12-7");
  });

  it("stays on the expected route while the student follows it", () => {
    const p = predict({ routeMap: step, studentAscii: "x + 7 - 7" });
    expect(p.predictive.replace(/\s+/g, "").startsWith("x+7-7")).toBe(true);
    expect(provesEquivalent(step.expected, p.predictive)).toBe(true);
  });

  it("recalculates but keeps the student's writing at the front", () => {
    const p = predict({ routeMap: step, studentAscii: "12 -7" });
    expect(p.status).toBe("incomplete");
    expect(p.predictive.replace(/\s+/g, "").startsWith("12-7")).toBe(true);
    expect(provesEquivalent(step.expected, p.predictive)).toBe(true);
  });

  it("keeps re-routing as the student writes more", () => {
    const p = predict({ routeMap: step, studentAscii: "12 -7 =" });
    expect(p.predictive.replace(/\s+/g, "").startsWith("12-7=")).toBe(true);
    expect(provesEquivalent(step.expected, p.predictive)).toBe(true);
  });

  it("reports a dead end instead of inventing another line", () => {
    const p = predict({ routeMap: step, studentAscii: "99" });
    expect(p.status).toBe("no_route");
    expect(p.predictive).toBe("");
  });
});
