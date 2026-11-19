import { describe, expect, it } from "vitest";
import {
  MCQ_RULE,
  MCQ_STRUCTURE_CLAUSE,
  MIXED_MCQ_GUIDANCE,
  parseInlineMcq,
} from "../inlineMcq";
import { arrangeLessonSessions, sessionMarkerAt } from "../sessionArrange";
import { normalizeInlineMcqDocument } from "../normalizeInlineMcq";
import { verifySessionStructure } from "../../../../supabase/functions/notebook-ai/sessionStructureVerifier";
import { verifyUpscale } from "../../../../supabase/functions/notebook-ai/upscaleVerifier";
import { PRESERVE_CONTENT_STANDARD } from "../../../../supabase/functions/notebook-ai/preserveContentStandard";
import { SESSION_STRUCTURE_STANDARD } from "../../../../supabase/functions/notebook-ai/sessionStructureStandard";
import { UPSCALING_STANDARD } from "../../../../supabase/functions/notebook-ai/upscalingStandard";
import { verifyPreserveContent } from "../../../../supabase/functions/notebook-ai/preserveContentVerifier";

const SHOT2 = [
  "Question 8",
  'Does "the nicest colours" define a mathematical set without a rule?',
  "A. Yes, because everyone can name at least one colour",
  "B. Yes, because colours are well-known objects in nature",
  "C. No, because there are too many colours in the world",
  'D. No, because "nicest" is subjective and lacks an objective membership.',
  "Correct Answer: D",
  'Explanation: A set must be well-defined. Because "nicest" is a matter of taste, it is impossible to objectively decide whether a given colour belongs in the collection.',
].join("\n");

const SHOT1 = [
  "Question 1",
  "V1",
  "V1. Beginner/JSS: Name the variable in 5x.",
  "A. 5",
  "B. x",
  "C. 5x",
  "D. 1",
  "Correct Answer: B",
  "V2",
  "V2. Beginner/JSS: Find the constant term in 3a + 7.",
  "A. 3",
  "B. a",
  "C. 7",
  "D. 3a",
  "Correct Answer: C",
  "V3",
  "V3. Intermediate/SSS:",
  "List the signed terms of 4x² - 3x + 8.",
  "Solution 1",
  "Terms are separated by addition or subtraction at the outer level.",
].join("\n");

const lines = (s: string) => s.split("\n").filter(l => l.trim());

describe("supplied MCQ forms", () => {
  it("accepts every answer form named in the shared rule, and does not change the letter", () => {
    for (const form of MCQ_RULE.answerStyles) {
      if (form.includes("True")) continue;
      expect(MIXED_MCQ_GUIDANCE).toContain(form);
      const q = parseInlineMcq(`Name the variable in 5x.\nA. 5\nB. x\nC. 5x\nD. 1\n${form}`);
      expect(q?.answer, form).toBe("B");
      expect(q?.options.map(o => o.text)).toEqual(["5", "x", "5x", "1"]);
    }
  });

  it("accepts option styles, lowercase labels, and up to six options", () => {
    expect(parseInlineMcq("Pick one.\nA - 5\nB - x\nC - 5x\nCorrect Answer: B")?.options.map(o => o.text)).toEqual(["5", "x", "5x"]);
    expect(parseInlineMcq("Pick one.\nA: 5\nB: x\nCorrect Answer: A")?.answer).toBe("A");
    expect(parseInlineMcq("Pick one.\na. 5\nb. x\nCorrect answer is b")?.answer).toBe("B");
    expect(parseInlineMcq("Pick one.\n(a) 5\n(b) x\nCorrect option is A")?.options[0]).toEqual({ label: "A", text: "5" });
    const six = parseInlineMcq("Pick one.\nA. 1\nB. 2\nC. 3\nD. 4\nE. 5\nF. 6\nAnswer: F");
    expect(six?.options.map(o => o.label)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(six?.answer).toBe("F");
    expect(parseInlineMcq("Pick one.\nA. 1\nB. 2\nC. 3\nD. 4\nE. 5\nF. 6\nG. 7\nAnswer: A")).toBeNull();
  });

  it("accepts True/False without inventing a different choice", () => {
    const bare = parseInlineMcq("Is 2 even?\nTrue\nFalse\nCorrect Answer: True");
    expect(bare).toMatchObject({ answer: "True", options: [{ label: "True", text: "True" }, { label: "False", text: "False" }] });
    expect(parseInlineMcq("Is 2 even?\nA. True\nB. False\nCorrect Answer: True")?.answer).toBe("A");
    expect(parseInlineMcq("Is 2 even?\nA. True\nB. False\nAnswer: B")?.answer).toBe("B");
  });

  it("keeps a trailing explanation out of the question and does not guess when the tail is another question", () => {
    const q = parseInlineMcq(SHOT2.replace(/^Question 8\n/, ""));
    expect(q?.answer).toBe("D");
    expect(q?.text.startsWith('Does "the nicest colours"')).toBe(true);
    expect(q?.explanation).toContain("A set must be well-defined");
    expect(q?.options).toHaveLength(4);
    expect(parseInlineMcq("Find x.\nA. 1\nB. 2\nCorrect Answer: A\nQuestion 2\nFind y.")).toBeNull();
    expect(parseInlineMcq("Find x.\nSolution\nx = 7")).toBeNull();
  });

  it("keeps variant labels inside the stem", () => {
    const q = parseInlineMcq("V1\nV1. Beginner/JSS: Name the variable in 5x.\nA. 5\nB. x\nC. 5x\nD. 1\nCorrect Answer: B");
    expect(q?.text).toBe("V1\nV1. Beginner/JSS: Name the variable in 5x.");
    expect(q?.answer).toBe("B");
  });
});

describe("screenshot lessons", () => {
  it("treats question 8 as an MCQ and moves the explanation out of the question", () => {
    const out = arrangeLessonSessions(SHOT2);
    expect(out).toContain("**Question 8**");
    expect(out).toContain("Correct Answer: D");
    expect(out).toContain("**Explanation**");
    expect(out).toContain("A set must be well-defined.");
    expect(out).not.toMatch(/^Solution/m);
    expect(arrangeLessonSessions(out)).toBe(out);
    const body = out.split("**Explanation**")[0];
    expect(parseInlineMcq(body)).toMatchObject({ answer: "D" });
    expect(verifySessionStructure(`## Question 8\n${body.replace("**Question 8**", "").trim()}\n## Explanation\nA set must be well-defined.`).defects).toEqual([]);
  });

  it("splits question 1 into MCQ variants and one worked variant, keeping every label", () => {
    const out = arrangeLessonSessions(SHOT1);
    expect(out).toContain("V1\nV1. Beginner/JSS: Name the variable in 5x.");
    expect(out).toContain("V2\nV2. Beginner/JSS: Find the constant term in 3a + 7.");
    expect(out).toContain("V3\nV3. Intermediate/SSS:\nList the signed terms of 4x² - 3x + 8.");
    const l = lines(out);
    expect(l.filter(line => line === "**Question 1**" || line === "**Question 2**" || line === "**Question 3**")).toEqual([
      "**Question 1**", "**Question 2**", "**Question 3**",
    ]);
    expect(l.filter(line => line.startsWith("Solution"))).toEqual(["Solution 3"]);
    expect(out).toContain("Terms are separated by addition or subtraction at the outer level.");
    expect(arrangeLessonSessions(out)).toBe(out);
    expect(verifyPreserveContent(SHOT1, out).some(d => /invent/i.test(d))).toBe(false);
  });

  it("leaves a worked question on Floating Numbers and an all-MCQ lesson without solutions", () => {
    const worked = "Question 9\nDoes \"the integers from 1 to 5 inclusive\" define a set?\nSolution 9\nYes, it defines a set because there is a clear, objective rule.";
    expect(lines(arrangeLessonSessions(worked))).toEqual([
      "**Question 9**",
      'Does "the integers from 1 to 5 inclusive" define a set?',
      "Solution 9",
      "Yes, it defines a set because there is a clear, objective rule.",
    ]);
    const allMcq = [
      "Question 1", "Pick a number.", "A. 1", "B. 2", "Correct Answer: A",
      "Question 2", "Pick a letter.", "A. p", "B. q", "Answer: B",
    ].join("\n");
    const out = arrangeLessonSessions(allMcq);
    expect(out).not.toMatch(/Solution/);
    expect(parseInlineMcq("Pick a number.\nA. 1\nB. 2\nCorrect Answer: A")?.answer).toBe("A");
  });

  it("does not turn a variant label into a heading, and still keeps an explicit level section", () => {
    expect(sessionMarkerAt("V3. Intermediate/SSS:")).toBeNull();
    expect(sessionMarkerAt("V1")).toBeNull();
    expect(sessionMarkerAt("Correct Answer: B. 7")).toBeNull();
    expect(sessionMarkerAt("Explanation: A set must be well-defined.")).toBeNull();
    expect(sessionMarkerAt("### V1. Beginner/JSS")).toMatchObject({ kind: "group", title: "V1. Beginner/JSS" });
    expect(sessionMarkerAt("V1. Beginner/JSS")).toMatchObject({ kind: "group" });
  });

  it("moves an explanation out of a saved question without creating a solution", () => {
    const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
    const h = (text: string, level = 3) => ({ ...p(text), type: "heading", attrs: { level } });
    const source = {
      type: "doc",
      content: [
        h("Question 8"),
        p('Does "the nicest colours" define a mathematical set?'),
        p("A. Yes, because everyone can name one"),
        p('D. No, because "nicest" is subjective'),
        p("Correct Answer: D"),
        p("Explanation: A set must be well-defined."),
      ],
    };
    const once = normalizeInlineMcqDocument(source);
    expect(once.changed).toBe(true);
    const texts = once.doc.content.map((n: { content?: { text?: string }[] }) => n.content?.[0]?.text);
    expect(texts).toEqual([
      "Question 8",
      'Does "the nicest colours" define a mathematical set?',
      "A. Yes, because everyone can name one",
      'D. No, because "nicest" is subjective',
      "Correct Answer: D",
      "Explanation",
      "A set must be well-defined.",
    ]);
    expect(once.doc.content.some((n: { type: string; content?: { text?: string }[] }) => /^Solution/.test(n.content?.[0]?.text ?? ""))).toBe(false);
    expect(normalizeInlineMcqDocument(once.doc).changed).toBe(false);
  });

  it("does not demand a solution or floating completion for an MCQ that still carries its explanation", () => {
    const output = "## Question 8\n" + SHOT2.replace(/^Question 8\n/, "");
    expect(verifySessionStructure(output).defects).toEqual([]);
    expect(verifyUpscale(SHOT2, output, null).some(d => /no complete solution/i.test(d))).toBe(false);
  });
});

describe("prompt and parser stay on one definition", () => {
  it("puts the same clause in every AI Edit standard", () => {
    for (const standard of [UPSCALING_STANDARD, SESSION_STRUCTURE_STANDARD, PRESERVE_CONTENT_STANDARD, MIXED_MCQ_GUIDANCE]) {
      expect(standard).toContain(MCQ_STRUCTURE_CLAUSE);
    }
    expect(MCQ_STRUCTURE_CLAUSE).toContain("Intermediate/SSS:");
    expect(MCQ_STRUCTURE_CLAUSE).toContain("Floating Numbers");
    expect(MCQ_STRUCTURE_CLAUSE).toContain("Never infer or change the declared answer");
  });
});
