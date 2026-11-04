import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UPSCALING_STANDARD } from "../../../../supabase/functions/notebook-ai/upscalingStandard";
import { BENCHMARK_STANDARD } from "../../../../supabase/functions/notebook-ai/benchmarkStandard";
import {
  buildPreserveEditPrompt,
  PRESERVE_CONTENT_STANDARD,
} from "../../../../supabase/functions/notebook-ai/preserveContentStandard";
import {
  preserveContentCollapsed,
  preserveContentCorrection,
  preserveItemKeys,
  selectPreserveDraft,
  verifyPreserveContent,
} from "../../../../supabase/functions/notebook-ai/preserveContentVerifier";

const indexSource = readFileSync(
  fileURLToPath(new URL("../../../../supabase/functions/notebook-ai/index.ts", import.meta.url)),
  "utf8",
);

const pasted = `1. Solve 2x + 3 = 7
x = 2
2. Solve x + 1 = 4
x = 3`;

const arranged = `Exercise 1
Solve 2x + 3 = 7
Solution 1
x = 2
Exercise 2
Solve x + 1 = 4
Solution 2
x = 3`;

describe("preserve content prompt", () => {
  it("asks for verbatim substance and session structure only", () => {
    const { system, user } = buildPreserveEditPrompt({
      selection: pasted,
      instruction: "make these harder",
      subject: "Mathematics",
    });
    expect(system).toContain(PRESERVE_CONTENT_STANDARD);
    expect(system).toContain("Do not upgrade difficulty");
    expect(system).toContain("Do not write a solution that the paste does not already contain");
    expect(system).toContain("Do not summarise");
    expect(system).toContain("Do not invent an introduction");
    expect(system).toContain("three structured practice tiers");
    expect(system).toContain("Exercise N");
    expect(system).toContain("2^{5}");
    expect(system).not.toContain("EDUCATIONAL UPSCALING");
    expect(system).not.toContain("UPSKILL");
    expect(system).not.toContain(UPSCALING_STANDARD.slice(0, 80));
    expect(system).not.toContain(BENCHMARK_STANDARD.slice(0, 40));
    expect(user).toContain(pasted);
    expect(user).toContain("make these harder");
    expect(user).toContain("ignore any request to change, complete, or upgrade");
    expect(user).toContain("do not summarise it");
  });
});

/** The Session 3.1.1 failure: a 36-item paste returned as invented prose. */
const INTRO_ONLY_SHELL = `Introduction
Topic 3: Indices
Subtopic 3.1: Index Notation as Repeated Multiplication
Session 3.1.1: Index Notation as Repeated Multiplication
This session covers index notation across three structured practice tiers:

Explanation
Index notation is a concise method of expressing repeated multiplication of the same factor.
In the general expression aⁿ:
The base a is the factor being multiplied.
The index n is the number of times the factor appears in multiplication.
Evaluating the power :
In general algebraic terms:
The expression aⁿ denotes the product of n identical factors of a.
All expressions preserve standard superscript notation for powers, such as  and aⁿ`;

function indicesPaste(): string {
  const tiers = ["Beginner", "Intermediate", "Expert"] as const;
  const lines = ["Session 3.1.1: Index Notation as Repeated Multiplication"];
  let n = 1;
  for (const tier of tiers) {
    lines.push(tier);
    for (let i = 1; i <= 12; i += 1) {
      lines.push(`${i}. Write the product as a power (${tier} item ${n}).`);
      lines.push("Solution");
      lines.push(`2^${i} equals ${n}`);
      n += 1;
    }
  }
  return lines.join("\n");
}

function arrangedIndices(): string {
  const tiers = ["Beginner", "Intermediate", "Expert"] as const;
  const lines = ["Session 3.1.1: Index Notation as Repeated Multiplication"];
  let n = 1;
  for (const tier of tiers) {
    lines.push(tier);
    for (let i = 1; i <= 12; i += 1) {
      lines.push(`Exercise ${n}`);
      lines.push(`Write the product as a power (${tier} item ${n}).`);
      lines.push(`Solution ${n}`);
      lines.push(`2^${i} equals ${n}`);
      n += 1;
    }
  }
  return lines.join("\n");
}

describe("preserve content verifier", () => {
  it("accepts a faithful session arrangement, including a one-line solution", () => {
    expect(verifyPreserveContent(pasted, arranged)).toEqual([]);
    expect(verifyPreserveContent(pasted, arranged).join("\n")).not.toContain("complete solution");
  });

  it("rejects dropped or invented problems", () => {
    const dropped = verifyPreserveContent(pasted, "Exercise 1\nSolve 2x + 3 = 7\nSolution 1\nx = 2");
    expect(dropped.some((d) => d.includes("Do not drop"))).toBe(true);
    const invented = verifyPreserveContent(pasted, `${arranged}\nExercise 3\nSolve x + 9 = 10\nSolution 3\nx = 1`);
    expect(invented.some((d) => d.includes("Do not invent"))).toBe(true);
  });

  it("rejects an unarranged paste and a replaced method", () => {
    expect(verifyPreserveContent(pasted, pasted).some((d) => d.includes("lesson-note sessions"))).toBe(true);
    const src = "1. Solve 3x^2 + 4x + 5 = 0 using the quadratic formula\nx = -2";
    const out = "Exercise 1\nSolve 3x^2 + 4x + 5 = 0\nSolution 1\nFactorise\nx = -2";
    const defects = verifyPreserveContent(src, out);
    expect(defects.some((d) => d.includes("quadratic formula"))).toBe(true);
    expect(preserveContentCorrection(defects).toLowerCase()).toContain("do not write a solution that was not in the paste");
  });

  it("does not treat numbered working steps as extra problems", () => {
    const src = "Example 1\nSolve 2x + 3 = 7\n1. Subtract 3\n2. Divide by 2\nx = 2";
    const out = "Example 1\nSolve 2x + 3 = 7\nSolution 1\n1. Subtract 3\n2. Divide by 2\nx = 2";
    expect(verifyPreserveContent(src, out)).toEqual([]);
  });

  it("keeps every problem and solution from a multi-problem paste", () => {
    const paste = indicesPaste();
    const arranged = arrangedIndices();
    expect(preserveItemKeys(paste)).toHaveLength(36);
    expect(preserveItemKeys(arranged)).toHaveLength(36);
    expect(verifyPreserveContent(paste, arranged)).toEqual([]);
    expect(preserveContentCollapsed(paste, arranged)).toBe(false);
  });

  it("counts restarted question numbers in each tier", () => {
    const src = [
      "Beginner",
      "Question 1",
      "Simplify the product of a.",
      "Solution",
      "a squared",
      "Question 2",
      "Simplify the product of b.",
      "Solution",
      "b cubed",
      "Expert",
      "Question 1",
      "Simplify the product of c.",
      "Solution",
      "c squared",
      "Question 2",
      "Simplify the product of d.",
      "Solution",
      "d cubed",
    ].join("\n");
    expect(preserveItemKeys(src)).toHaveLength(4);
  });

  it("rejects an introduction-only rewrite of a 36-item paste and retries", () => {
    const paste = indicesPaste();
    const defects = verifyPreserveContent(paste, INTRO_ONLY_SHELL);
    const text = defects.join("\n");
    expect(text).toMatch(/introduction-only shell/i);
    expect(text).toMatch(/Do not drop/);
    expect(text).toMatch(/practice tiers/i);
    expect(text).toMatch(/Do not invent an introduction/i);
    expect(preserveContentCollapsed(paste, INTRO_ONLY_SHELL)).toBe(true);
    expect(preserveContentCorrection(defects).toLowerCase()).toContain("do not summarise");

    const arranged = arrangedIndices();
    const retried = selectPreserveDraft(
      paste,
      { content: INTRO_ONLY_SHELL, defects },
      { content: arranged, defects: verifyPreserveContent(paste, arranged) },
    );
    expect(retried.rejected).toBe(false);
    expect(retried.content).toBe(arranged);
    expect(retried.content).not.toContain("three structured practice tiers");

    const refused = selectPreserveDraft(
      paste,
      { content: INTRO_ONLY_SHELL, defects },
      { content: INTRO_ONLY_SHELL, defects },
    );
    expect(refused.rejected).toBe(true);
    expect(refused.content).toBe("");
    expect(refused.content).not.toContain("Introduction");
  });

  it("rejects an introduction shell when the questions are unnumbered sentences", () => {
    const lines = ["Index notation writes repeated multiplication."];
    for (let i = 1; i <= 8; i += 1) {
      lines.push(`Write the product of ${i} factors of a in index form.`);
      lines.push("Solution");
      lines.push(`a to the ${i}`);
    }
    const paste = lines.join("\n");
    const defects = verifyPreserveContent(paste, INTRO_ONLY_SHELL);
    expect(defects.some((d) => /introduction-only shell|dropped the teacher's sentences/i.test(d))).toBe(
      true,
    );
    expect(preserveContentCollapsed(paste, INTRO_ONLY_SHELL)).toBe(true);
    const refused = selectPreserveDraft(paste, { content: INTRO_ONLY_SHELL, defects }, null);
    expect(refused.rejected).toBe(true);
    expect(refused.content).toBe("");
  });

  it("rejects a draft that keeps the questions and drops the solutions", () => {
    const lines: string[] = [];
    const kept: string[] = [];
    for (let i = 1; i <= 4; i += 1) {
      lines.push(`${i}. Find the value of the power ${i}.`, "Solution", `value ${i}`);
      kept.push(`Exercise ${i}`, `Find the value of the power ${i}.`);
    }
    const defects = verifyPreserveContent(lines.join("\n"), kept.join("\n"));
    expect(defects.some((d) => d.includes("Restore every solution"))).toBe(true);
    expect(preserveContentCollapsed(lines.join("\n"), kept.join("\n"))).toBe(true);
  });

  it("accepts a glued power restored as a superscript", () => {
    const src = [
      "1. Evaluate 25",
      "Solution",
      "thirty two",
      "2. Evaluate 32",
      "Solution",
      "eight",
      "3. Evaluate 43",
      "Solution",
      "sixty four",
    ].join("\n");
    const out = [
      "Exercise 1",
      "Evaluate 2^{5}",
      "Solution 1",
      "thirty two",
      "Exercise 2",
      "Evaluate 3^{2}",
      "Solution 2",
      "eight",
      "Exercise 3",
      "Evaluate 4^{3}",
      "Solution 3",
      "sixty four",
    ].join("\n");
    expect(verifyPreserveContent(src, out)).toEqual([]);
  });

  it("does not call a tier phrase invented when the paste already says it", () => {
    const src = [
      "1. Keep this structured practice tiers question intact for class.",
      "Solution",
      "done once",
      "2. Keep the second structured practice tiers question intact too.",
      "Solution",
      "done twice",
      "3. Keep the third structured practice tiers question intact as well.",
      "Solution",
      "done thrice",
    ].join("\n");
    const out = [
      "Exercise 1",
      "Keep this structured practice tiers question intact for class.",
      "Solution 1",
      "done once",
      "Exercise 2",
      "Keep the second structured practice tiers question intact too.",
      "Solution 2",
      "done twice",
      "Exercise 3",
      "Keep the third structured practice tiers question intact as well.",
      "Solution 3",
      "done thrice",
    ].join("\n");
    expect(verifyPreserveContent(src, out).join("\n")).not.toMatch(/invented practice tiers/i);
    expect(verifyPreserveContent(src, out)).toEqual([]);
  });
});

describe("preserve content stays off Generate", () => {
  it("does not route AI Edit Generate through the preserve verifier", () => {
    const editStart = indexSource.indexOf('if (body.mode === "edit")');
    const editEnd = indexSource.indexOf('if (body.mode === "geometry")');
    const edit = indexSource.slice(editStart, editEnd);
    const preserveStart = edit.indexOf("if (b.preserve)");
    const preserveEnd = edit.indexOf("SOLUTION INTENT", preserveStart);
    const preserve = edit.slice(preserveStart, preserveEnd);
    const generate = edit.slice(preserveEnd);
    expect(preserve).toContain("selectPreserveDraft");
    expect(preserve).toContain("rejected: true");
    expect(preserve).not.toContain("UPSCALING_STANDARD");
    expect(preserve).not.toContain("verifyUpscale");
    expect(generate).toContain("${UPSCALING_STANDARD}");
    expect(generate).toContain("verifyUpscale");
    expect(generate).not.toContain("selectPreserveDraft");
    expect(generate).not.toContain("verifyPreserveContent");
    expect(generate).not.toContain("b.preserve");
    expect(indexSource.split("selectPreserveDraft(").length - 1).toBe(1);
    expect(UPSCALING_STANDARD).not.toContain("introduction-only shell");
    expect(UPSCALING_STANDARD).not.toContain("PRESERVE CONTENT");
  });
});
