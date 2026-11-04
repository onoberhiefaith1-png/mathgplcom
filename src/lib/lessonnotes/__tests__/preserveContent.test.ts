import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UPSCALING_STANDARD } from "../../../../supabase/functions/notebook-ai/upscalingStandard";
import { BENCHMARK_STANDARD } from "../../../../supabase/functions/notebook-ai/benchmarkStandard";
import {
  buildPreserveEditPrompt,
  PRESERVE_CONTENT_STANDARD,
} from "../../../../supabase/functions/notebook-ai/preserveContentStandard";
import { sanitizePresentation } from "../outputHygiene";
import { arrangePreservePaste } from "../../../../supabase/functions/notebook-ai/preserveContentArrange";
import {
  isPracticeTierLine,
  preserveContentCollapsed,
  preserveContentCorrection,
  preserveItemKeys,
  selectPreserveDraft,
  solutionMarkerCount,
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

const SESSION_311 = readFileSync(
  fileURLToPath(new URL("./fixtures/session-3.1.1-solutions.md", import.meta.url)),
  "utf8",
);

function exerciseNumbersByTier(text: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  let tier = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (isPracticeTierLine(line)) {
      tier = line;
      out[tier] = [];
      continue;
    }
    const n = line.match(/^Exercise (\d+)$/);
    if (n && tier) out[tier].push(Number(n[1]));
  }
  return out;
}

describe("preserve arranges Session 3.1.1 without the model", () => {
  it("keeps all 36 questions and solutions in restarted Exercise/Solution tiers", () => {
    const arranged = arrangePreservePaste(SESSION_311);
    expect(arranged, "deterministic arrange returned null").toBeTruthy();
    const note = arranged ?? "";
    const defects = verifyPreserveContent(SESSION_311, note);
    expect(defects, defects.join("\n")).toEqual([]);
    expect(preserveContentCollapsed(SESSION_311, note)).toBe(false);
    expect(preserveItemKeys(note)).toHaveLength(36);
    expect(solutionMarkerCount(note)).toBe(36);
    expect(note).not.toBe(INTRO_ONLY_SHELL);
    expect(note).not.toMatch(/this session covers/i);
    expect(note).not.toMatch(/practice tiers/i);
    expect(note).not.toMatch(/concise method of expressing/i);
    expect(note).toContain("Understood. I'll keep straightforward questions short");
    expect(note).toContain("3.1.1 — Index Notation as Repeated Multiplication");
    expect(note).toContain("That completes all 36 worked solutions");
    expect(note).toContain("Identify the base and index in 2^5.");
    expect(note).toContain("4×4×4=4^3");
    expect(note).toContain("the learner is incorrect");
    expect(note).toContain("2^4×3^2");
    expect(note).toContain("(a,n)=(16,2),(4,4),(2,8)");
    expect(note).toContain("(a,n)=(6,3)");
    expect(note).toContain("12≠81");
    expect(note).toContain("n=2, 4, 8");
    expect(note).not.toContain("\\times");
    expect(note).not.toContain("\\ ");

    const byTier = exerciseNumbersByTier(note);
    expect(Object.keys(byTier)).toEqual([
      "Beginner Practice",
      "Intermediate Practice",
      "Expert Practice",
    ]);
    for (const numbers of Object.values(byTier)) {
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }

    const labels = note.split("\n").map((l) => l.trim()).filter((l) => /^(Exercise|Solution) \d+$/.test(l));
    expect(labels).toHaveLength(72);
    for (let i = 0; i < labels.length; i += 2) {
      expect(labels[i]).toMatch(/^Exercise (\d+)$/);
      expect(labels[i + 1]).toBe(`Solution ${labels[i].slice("Exercise ".length)}`);
    }

    const cleaned = sanitizePresentation(note);
    expect(cleaned.match(/^Exercise \d+$/gm)).toHaveLength(36);
    expect(cleaned.match(/^Solution \d+$/gm)).toHaveLength(36);
    expect(cleaned).toContain("4×4×4=4^3");
    expect(cleaned).toContain("12≠81");
    expect(cleaned).not.toContain("\\times");
    expect(cleaned).not.toContain("\\ne");
    expect(cleaned).toContain("three times as a factor");
    expect(cleaned).toContain("Identify the base and index in 2^5.");
    expect(cleaned).toContain("That completes all 36 worked solutions");
  });

  it("keeps an existing activity name and ignores a paste with no solution markers", () => {
    const classwork = [
      "Classwork 1. Find 2+2.",
      "Solution",
      "4",
      "Classwork 2. Find 3+3.",
      "Solution",
      "6",
      "Classwork 3. Find 4+4.",
      "Solution",
      "8",
    ].join("\n");
    const arranged = arrangePreservePaste(classwork);
    expect(arranged).toContain("Classwork 1");
    expect(arranged).toContain("Classwork 3");
    expect(arranged).not.toMatch(/^Exercise /m);
    expect(verifyPreserveContent(classwork, arranged ?? "")).toEqual([]);

    expect(arrangePreservePaste(pasted)).toBeNull();
    expect(arrangePreservePaste("1. One\n2. Two\n3. Three")).toBeNull();
    expect(isPracticeTierLine("Beginner Practice")).toBe(true);
    expect(isPracticeTierLine("The beginner practice is below.")).toBe(false);
  });

  it("does not turn a latex command into escape residue", () => {
    const kept = sanitizePresentation("4\\times4 and 12\\ne81 and \\text{hi}");
    expect(kept).toContain("\\times");
    expect(kept).toContain("\\ne");
    expect(kept).toContain("\\text{hi}");
    expect(kept).not.toContain("  imes");
    expect(sanitizePresentation("keep\\n apart")).toBe("keep\n apart");
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
    expect(generate).not.toContain("arrangePreservePaste");
    expect(generate).not.toContain("b.preserve");
    const arrangeAt = preserve.indexOf("arrangePreservePaste");
    const modelAt = preserve.indexOf("callAIComplete");
    expect(arrangeAt).toBeGreaterThan(-1);
    expect(arrangeAt).toBeLessThan(modelAt);
    expect(indexSource.split("selectPreserveDraft(").length - 1).toBe(1);
    expect(UPSCALING_STANDARD).not.toContain("introduction-only shell");
    expect(UPSCALING_STANDARD).not.toContain("PRESERVE CONTENT");
  });
});
