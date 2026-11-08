// Mounted controller with realistic board-like state changes.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
const { setupDom } = await import("@/test/domRender");
const { useNoteGuidance } = await import("@/lib/smartboard/useNoteGuidance");

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
