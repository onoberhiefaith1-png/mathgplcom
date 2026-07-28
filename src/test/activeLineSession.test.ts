// One active line + editing-session (Start Point / End Point) laws.
import { describe, it, expect } from "vitest";
import {
  startSession,
  freezeSession,
  recordEntry,
  isFrozen,
} from "@/lib/smartboard/editingSession";

/** Minimal model of the unified cursor: one state, many consumers. */
const makeBoard = () => {
  let activeLine = 0;
  const consumers = { floating: 0, preview: 0, reasoning: 0, check: 0 };
  const setActiveLine = (k: number) => {
    activeLine = k;
    consumers.floating = k;
    consumers.preview = k;
    consumers.reasoning = k;
    consumers.check = k;
  };
  return { get activeLine() { return activeLine; }, consumers, setActiveLine };
};

describe("one active line", () => {
  it("moving the line from the Floating Number Display updates every consumer", () => {
    const b = makeBoard();
    b.setActiveLine(4);
    expect(b.consumers).toEqual({ floating: 4, preview: 4, reasoning: 4, check: 4 });
  });

  it("a Presenter Preview click on line 6 pulls the floating strip to line 6", () => {
    const b = makeBoard();
    b.setActiveLine(4);
    b.setActiveLine(6); // preview click
    expect(b.consumers.floating).toBe(6);
    expect(b.consumers.preview).toBe(6);
    expect(b.activeLine).toBe(6);
  });
});

describe("editing session", () => {
  it("collects every input source between Start and End point", () => {
    const s = startSession(2, "l2");
    recordEntry(s, "chip");
    recordEntry(s, "keyboard");
    recordEntry(s, "ai");
    expect(s.entries.map((e) => e.source)).toEqual(["chip", "keyboard", "ai"]);
  });

  it("Example 1 — '= 0' clicked in the same session joins the expression", () => {
    const s = startSession(1, "l1");
    let board = "ax^2 + bx + c";
    recordEntry(s, "keyboard");
    board += " = 0"; // preview chip, same session
    recordEntry(s, "chip");
    freezeSession(s, board);
    expect(s.frozenAscii).toBe("ax^2 + bx + c = 0");
  });

  it("Example 2 — content typed after the End Point never changes the result", () => {
    const s = startSession(1, "l1");
    freezeSession(s, "ax^2 + bx + c = 0"); // student leaves line 2
    // board now visually shows the extra "3x" typed on line 3
    freezeSession(s, "ax^2 + bx + c = 0 3x");
    expect(s.frozenAscii).toBe("ax^2 + bx + c = 0");
    expect(isFrozen(s)).toBe(true);
  });

  it("Example 3 — manual '+ c' and '= 0' inside the session count", () => {
    const s = startSession(1, "l1");
    const board = "ax^2 + bx" + " + c" + " = 0";
    freezeSession(s, board);
    expect(s.frozenAscii).toBe("ax^2 + bx + c = 0");
  });

  it("Example 4 — a duplicated term inside the session stays in the expression", () => {
    const s = startSession(1, "l1");
    freezeSession(s, "ax^2 + bx + c + c = 0");
    expect(s.frozenAscii).toBe("ax^2 + bx + c + c = 0");
    expect(s.frozenAscii).not.toBe("ax^2 + bx + c = 0"); // graded Incorrect
  });

  it("entries are rejected once the session is frozen", () => {
    const s = startSession(3, "l3");
    freezeSession(s, "x = 5");
    recordEntry(s, "keyboard");
    expect(s.entries).toHaveLength(0);
  });
});
