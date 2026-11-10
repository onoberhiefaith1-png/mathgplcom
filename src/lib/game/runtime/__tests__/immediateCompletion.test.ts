import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { questionCompletionDue } from "../completion";
import { freezeElapsedOnce, practiceComplete } from "@/lib/smartboard/completionProgress";

const q = { questionRowId: "q", lineIds: ["l1", "l2", "l3"], lineMarks: [2, 2, 2] };

describe("Game question completes on the last award", () => {
  it("completes the moment every required line is paid, whatever line the board is on", () => {
    // last award was line 2 (solved out of order) — no last-row requirement
    expect(questionCompletionDue(q, ["q:l1", "q:l3", "q:l2"], false)).toBe(true);
  });
  it("not before the last required line", () => {
    expect(questionCompletionDue(q, ["q:l1", "q:l2"], false)).toBe(false);
  });
  it("exactly once: rapid duplicate awards do not complete twice", () => {
    const done = new Set<string>();
    let completions = 0;
    for (const keys of [["q:l1", "q:l2", "q:l3"], ["q:l1", "q:l2", "q:l3"]]) {
      if (questionCompletionDue(q, keys, done.has("q"))) { done.add("q"); completions++; }
    }
    expect(completions).toBe(1);
  });
  it("a question with nothing to solve never completes by itself", () => {
    expect(questionCompletionDue({ questionRowId: "z", lineIds: [] }, [], false)).toBe(false);
    expect(questionCompletionDue({ questionRowId: "z", lineIds: ["n"], lineNoteOnly: [true] }, [], false)).toBe(false);
  });
  it("useGameRuntime completes from the award effect, not from the last-row line event", () => {
    const src = readFileSync(resolve(__dirname, "../../../../hooks/useGameRuntime.ts"), "utf8");
    expect(src).toMatch(/questionCompletionDue\(question, awarded\.current, already\)/);
    expect(src).not.toMatch(/atLastRow/);
  });
});

describe("Practice completes at full marks", () => {
  it("6/6 completes immediately; 0 totals never do", () => {
    expect(practiceComplete({ score: 6, total: 6, timerActive: false, timerCompleted: false })).toBe(true);
    expect(practiceComplete({ score: 4, total: 6, timerActive: false, timerCompleted: false })).toBe(false);
    expect(practiceComplete({ score: 0, total: 0, timerActive: false, timerCompleted: false })).toBe(false);
    expect(practiceComplete({ score: 6, total: 6, timerActive: true, timerCompleted: true })).toBe(true);
  });
  it("captures the time once", () => {
    const first = freezeElapsedOnce(null, 1000, 61_000);
    expect(first).toBe(60_000);
    expect(freezeElapsedOnce(first, 1000, 99_000)).toBe(60_000);
    expect(freezeElapsedOnce(null, null, 5)).toBeNull();
  });
  it("the board shows Completed with the time from the shared rule", () => {
    const src = readFileSync(resolve(__dirname, "../../../../components/smartboard/PresentationView.tsx"), "utf8");
    expect(src).toMatch(/practiceComplete\(\{\s*score: shownScore, total: shownTotal/);
    expect(src).toMatch(/data-testid="practice-complete"/);
  });
});

describe("Correct answers turn green and award immediately", () => {
  it("acceptLineAward still records marks when table studentAscii is empty", () => {
    const src = readFileSync(resolve(__dirname, "../../../../hooks/useGameRuntime.ts"), "utf8");
    expect(src).toMatch(/event\.studentAscii\.trim\(\) \|\| `\(line:\$\{event\.lineId\}\)`/);
    expect(src).not.toMatch(/if \(index < 0 \|\| !awardedExpression\) return/);
  });
  it("table tracks are awarded on the same tick as the cell update, not only after the debounce", () => {
    const src = readFileSync(resolve(__dirname, "../../../../components/smartboard/PresentationView.tsx"), "utf8");
    expect(src).toMatch(/void gradeTableTrackRef\.current\?\.\(idx, "auto"\)/);
    expect(src).toMatch(/correctCellKeysByTable/);
    expect(src).toMatch(/CORRECT_ANSWER_INK/);
  });
  it("a completed Game writing line is painted with the correct-answer ink", () => {
    const src = readFileSync(resolve(__dirname, "../../../../pages/imagine/ImaginePlayPage.tsx"), "utf8");
    expect(src).toMatch(/correctInk: CORRECT_ANSWER_INK/);
  });
});
