import { describe, expect, it } from "vitest";
import {
  countScripts,
  joinChipsForMirror,
  liftUnicodeScripts,
  mirrorLessonNoteRow,
} from "@/lib/smartboard/mirrorFromLessonNote";
import { buildFloatingLines, reservoirFromShared } from "@/lib/smartboard/floatingShared";

describe("floating chip fidelity", () => {
  it("keeps powers when chips are written together", () => {
    const text = joinChipsForMirror(["2x²", "+", "5²"]);
    expect(countScripts(text)).toBe(2);
    const m = mirrorLessonNoteRow(text);
    expect(m.signature).toContain("^(2)");
  });

  it("keeps a power whose base sits in the previous chip", () => {
    const text = joinChipsForMirror(["2s", "²"]);
    expect(countScripts(text)).toBe(1);
  });

  it("lifts a leading script when a base precedes it", () => {
    expect(liftUnicodeScripts("²", "2s")).toBe("^{2}");
    expect(liftUnicodeScripts("²", "")).toBe("²");
  });

  it("never merges lines when boundaries exist", () => {
    const lines = buildFloatingLines("r1", {
      beatId: "r1",
      caption: "",
      fragments: ["a", "b", "c"],
      lines: [
        { equation: "1", fillers: ["a"], containers: [], fragmentStart: 0, fragmentEnd: 1 },
        { equation: "2", fillers: ["b", "c"], containers: [], fragmentStart: 1, fragmentEnd: 3 },
      ],
    } as never);
    expect(lines).toHaveLength(2);
    expect(lines[0].chips.map((c) => c.token)).toEqual(["a"]);
    expect(lines[1].chips.map((c) => c.token)).toEqual(["b", "c"]);
    expect(new Set(lines.map((l) => l.lineId)).size).toBe(2);
  });

  it("rebuilds the classroom reservoir from the publisher's exact lines", () => {
    const shared = {
      resId: "question-1",
      viewIdx: 0,
      activeIdx: 0,
      lineIdx: 1,
      usedOrder: [],
      reveal: 0,
      offset: 0,
      reentryOffset: 0,
      lines: [
        { lineId: "line-1", lineIdx: 0, chips: [{ chipId: "c1", token: "2s²", absIdx: 0 }] },
        { lineId: "line-2", lineIdx: 1, chips: [{ chipId: "c2", token: "a□", absIdx: 1 }] },
      ],
    };
    const local = {
      beatId: "question-1",
      caption: "Question",
      fragments: ["stale"],
      lines: [{ equation: "stale", fillers: ["stale"], containers: [], fragmentStart: 0, fragmentEnd: 1 }],
    };
    const rebuilt = reservoirFromShared(shared, local as never);
    expect(rebuilt.lines).toHaveLength(2);
    expect(rebuilt.lines.map((line) => line.fillers)).toEqual([["2s²"], ["a□"]]);
    expect(rebuilt.fragments).toEqual(["2s²", "a□"]);
  });
});
