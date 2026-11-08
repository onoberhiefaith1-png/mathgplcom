// Mounted controller with realistic board-like state changes.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
const { setupDom } = await import("@/test/domRender");
const { useNoteGuidance, notesDueOnLineChange, gameLineForward, makeLocalLineSetter } = await import("@/lib/smartboard/useNoteGuidance");

type Api = ReturnType<typeof useNoteGuidance>;
let api: Api;
let writes: Array<[number, string]>;
let notes: Record<number, string>;
let lines = 3;
function Probe({ q, canWrite }: { q: string; canWrite: boolean }) {
  api = useNoteGuidance({
    questionKey: q,
    noteFor: (k) => notes[k] ?? "",
    lineCount: () => lines,
    canWrite,
    write: (k, n) => writes.push([k, n]),
  });
  return null;
}

describe("useNoteGuidance (mounted)", () => {
  let dom: ReturnType<typeof setupDom>;
  beforeEach(async () => {
    writes = []; lines = 3;
    notes = { 0: "The base is the number being multiplied repeatedly.", 1: "", 2: "The index tells us how many times the base appears." };
    dom = setupDom();
    await dom.render(<Probe q="qA" canWrite />);
  });
  afterEach(async () => { await dom.cleanup(); });
  const run = async (f: () => void) => { await act(async () => f()); };

  it("auto-advance / game advance / last line completion each write the left line's note once", async () => {
    await run(() => api.leaveLine(0, 1));
    await run(() => api.leaveLine(0, 1)); // duplicate event
    await run(() => api.leaveLine(2, 3)); // last line completed, no next line
    expect(writes).toEqual([[0, notes[0]], [2, notes[2]]]);
    expect([...api.shown].sort()).toEqual([0, 2]);
  });

  it("Next that already showed the note (markShown) is not doubled", async () => {
    await run(() => { api.markShown(0); api.leaveLine(0, 1); });
    expect(writes).toEqual([]);
  });

  it("back, same-line and no-note moves write nothing; future notes never leak", async () => {
    await run(() => api.leaveLine(1, 2)); // line 1 has no note
    await run(() => api.leaveLine(2, 1)); // back
    await run(() => api.leaveLine(1, 1));
    expect(writes).toEqual([]);
  });

  it("dismissed note stays dismissed on the same attempt; Reset brings it back", async () => {
    await run(() => api.leaveLine(0, 1));
    await run(() => api.leaveLine(0, 2));
    expect(writes).toHaveLength(1);
    await run(() => api.resetAttempt());
    await run(() => api.leaveLine(0, 1));
    expect(writes).toHaveLength(2);
  });

  it("question A → B with the same line index starts fresh", async () => {
    await run(() => api.leaveLine(0, 1));
    await dom.render(<Probe q="qB" canWrite />);
    expect(api.shown.size).toBe(0);
    await run(() => api.leaveLine(0, 1));
    expect(writes).toHaveLength(2);
  });

  it("note text arriving after the line was left is shown then; future lines are not", async () => {
    notes = {};
    await run(() => api.leaveLine(0, 1));
    expect(writes).toEqual([]);
    notes = { 0: "late note", 1: "future note" };
    await run(() => api.reconcileLate());
    expect(writes).toEqual([[0, "late note"]]);
  });

  it("read-only / mirrored boards never write", async () => {
    await dom.render(<Probe q="qA" canWrite={false} />);
    await run(() => api.leaveLine(0, 1));
    await run(() => api.reconcileLate());
    expect(writes).toEqual([]);
  });

  it("old board setter stays in sync for a following leaveLine", async () => {
    await run(() => { api.setShown((p) => new Set(p).add(0)); api.leaveLine(0, 1); });
    expect(writes).toEqual([]);
  });
});

describe("notesDueOnLineChange (used by leaveLine)", () => {
  const base = { lineCount: 3, noteFor: (k: number) => (k === 0 ? "n0" : ""), shown: new Set<number>(), userDriven: true };
  it("only the line left, forward, with an authored note, not yet shown", () => {
    expect(notesDueOnLineChange({ ...base, from: 0, to: 2 })).toEqual([0]);
    expect(notesDueOnLineChange({ ...base, from: 1, to: 2 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, from: 0, to: 0 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, shown: new Set([0]), from: 0, to: 1 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, from: 5, to: 6 })).toEqual([]);
  });
});

describe("gameLineForward (Game runtime adapter)", () => {
  it("first value / restore after mount is not an advance", () => {
    expect(gameLineForward(null, "q1", 3)).toBeNull();
  });
  it("a later line of the same question is an advance", () => {
    expect(gameLineForward({ key: "q1", line: 0 }, "q1", 1)).toEqual({ from: 0, to: 1 });
  });
  it("a new question (even a higher index) is not an advance", () => {
    expect(gameLineForward({ key: "q1", line: 0 }, "q2", 2)).toBeNull();
  });
  it("same or earlier line is not an advance", () => {
    expect(gameLineForward({ key: "q1", line: 2 }, "q1", 2)).toBeNull();
    expect(gameLineForward({ key: "q1", line: 2 }, "q1", 1)).toBeNull();
  });
});

// Integration: the board's actual local setter wired to the controller, the
// same way PresentationView wires it.
import { useMemo, useRef, useState } from "react";
let board: { set: React.Dispatch<React.SetStateAction<number>>; raw: (n: number) => void; line: number; engaged: boolean; g: ReturnType<typeof useNoteGuidance> };
function Board({ q }: { q: string }) {
  const [line, setLine] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const now = useRef(0);
  now.current = line;
  const g = useNoteGuidance({ questionKey: q, noteFor: (k) => notes[k] ?? "", lineCount: () => lines, canWrite: true, write: (k, n) => writes.push([k, n]) });
  const leave = useRef(g.leaveLine); leave.current = g.leaveLine;
  const set = useMemo(() => makeLocalLineSetter({ now, setLine, setEngaged, onMove: (a, b) => leave.current(a, b) }), []);
  board = { set, raw: setLine, line, engaged, g };
  return null;
}

describe("board line setter → note controller", () => {
  let dom: ReturnType<typeof setupDom>;
  beforeEach(async () => {
    writes = []; lines = 3;
    notes = { 0: "n0", 1: "n1", 2: "n2" };
    dom = setupDom();
    await dom.render(<Board q="lessonA|q1" />);
  });
  afterEach(async () => { await dom.cleanup(); });

  it("local forward (number and updater) writes the left line's note once; engagement set", async () => {
    await act(async () => board.set(1));
    await act(async () => board.set((c) => c + 1));
    await act(async () => board.set((c) => c)); // same line
    expect(writes).toEqual([[0, "n0"], [1, "n1"]]);
    expect(board.line).toBe(2);
    expect(board.engaged).toBe(true);
  });

  it("two forward updaters in one event chain correctly without duplicates", async () => {
    await act(async () => { board.set((c) => c + 1); board.set((c) => c + 1); });
    expect(writes).toEqual([[0, "n0"], [1, "n1"]]);
    expect(board.line).toBe(2);
  });

  it("raw restore / remote set never writes; back never writes", async () => {
    await act(async () => board.raw(2));
    expect(writes).toEqual([]);
    await act(async () => board.set(0));
    expect(writes).toEqual([]);
  });

  it("new question on a reused board does not carry shown notes", async () => {
    await act(async () => board.set(1));
    await dom.render(<Board q="lessonA|q2" />);
    await act(async () => board.raw(0));
    await act(async () => board.set(1));
    expect(writes).toEqual([[0, "n0"], [0, "n0"]]);
  });
});
