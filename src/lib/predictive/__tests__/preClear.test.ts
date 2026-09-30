import { describe, expect, it } from "vitest";
import { completionCandidates, PreClearedLines } from "../preClear";

describe("completionCandidates", () => {
  const atoms = ["x", "+7", "=", "12"];

  it("offers the finished line when nothing is left to place", () => {
    expect(completionCandidates({ studentAscii: "x + 7 = 12", atoms })).toEqual(["x + 7 = 12"]);
  });

  it("offers the completions the remaining pieces could produce", () => {
    const list = completionCandidates({ studentAscii: "x + 7 =", atoms });
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((c) => c.replace(/\s+/g, "") === "x+7=12")).toBe(true);
  });

  it("asks the ordered completion from the very first piece placed", () => {
    const list = completionCandidates({ studentAscii: "x", atoms: ["x", "+", "7", "=", "1", "2"] });
    expect(list.some((c) => c.replace(/\s+/g, "") === "x+7=12")).toBe(true);
  });

  it("warms up an empty line from its own Floating Numbers", () => {
    const candidates = completionCandidates({ studentAscii: "  ", atoms });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => atoms.every((a) => c.includes(a)))).toBe(true);
  });

  it("produces nothing when there are no Floating Numbers at all", () => {
    expect(completionCandidates({ studentAscii: "  ", atoms: [] })).toEqual([]);
  });
});

describe("PreClearedLines", () => {
  it("only reports lines the marking service approved", () => {
    const store = new PreClearedLines();
    store.accept("q1:l1", ["x + 7 = 12"]);
    expect(store.isCleared("q1:l1", "x+7=12")).toBe(true);
    expect(store.isCleared("q1:l1", "x + 12 = 7")).toBe(false);
    expect(store.isCleared("q1:l2", "x + 7 = 12")).toBe(false);
  });

  it("asks for each candidate once per line", () => {
    const store = new PreClearedLines();
    expect(store.unasked("q1:l1", ["x + 7 = 12", "12 = x + 7"]).length).toBe(2);
    store.markAsked("q1:l1", ["x + 7 = 12"]);
    expect(store.unasked("q1:l1", ["x+7=12", "12 = x + 7"])).toEqual(["12 = x + 7"]);
  });

  it("forgets everything on reset", () => {
    const store = new PreClearedLines();
    store.accept("q1:l1", ["x + 7 = 12"]);
    store.reset();
    expect(store.isCleared("q1:l1", "x + 7 = 12")).toBe(false);
  });
});
