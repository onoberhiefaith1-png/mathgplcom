// Regression: a Markdown export (doubled \\( delimiters, # headings, fenced
// number lines, "Question V1") used to miss the Preserve gate added in
// e1be5b268 (2026-11-04) and then lose its headings in f4e2e06ed (2026-11-05).
// Previously-good pastes — plain \( \), $...$, "Question 1.", "Beginner Practice"
// — must keep arranging the same way.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { arrangePreservePaste } from "../../../../supabase/functions/notebook-ai/preserveContentArrange";
import { verifyPreserveContent, preserveContentCollapsed } from "../../../../supabase/functions/notebook-ai/preserveContentVerifier";
import { arrangeLessonSessions, finaliseLessonImport } from "../sessionArrange";
import { aiTextToNodes } from "../aiToNodes";

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const INEQUALITIES = read("inequalities-6.1.2.md");
const GOOD = read("session-3.1.1-solutions.md");

const RAW = /\\\(|\\\)|\\\[|\\\]|\\boxed\b|\\{2,}\(/;

function walk(nodes: any[], visit: (n: any) => void) {
  for (const n of nodes) {
    if (!n) continue;
    visit(n);
    if (Array.isArray(n.content)) walk(n.content, visit);
  }
}

describe("previously-good imports still arrange", () => {
  it("keeps the 3.1.1 paste as Beginner/Intermediate/Expert questions and solutions", () => {
    const arranged = arrangePreservePaste(GOOD);
    expect(arranged).toBeTruthy();
    expect(verifyPreserveContent(GOOD, arranged ?? "")).toEqual([]);
    expect(arranged!.split("\n")[0]).toBe("**Beginner Practice**");
    expect(arranged).toContain("Identify the base and index in 2^5.");
    expect(arranged).toContain("4×4×4=4^3");
    expect(arranged).not.toMatch(RAW);
    expect(arrangeLessonSessions(GOOD)).toContain("\\(2^5\\)");
    expect(arrangeLessonSessions(arrangeLessonSessions(GOOD))).toBe(arrangeLessonSessions(GOOD));
  });

  it("repairs a plain \\( \\) paste and leaves $...$ for the renderer", () => {
    const old = [
      "Beginner Practice",
      "Question 1. Solve \\(x+5<12\\).",
      "Solution",
      "\\(x<7\\)",
      "Question 2. Solve \\(2x\\ge4\\).",
      "Solution",
      "\\(x\\ge2\\)",
      "Question 3. Solve $3x<9$.",
      "Solution",
      "$x<3$",
    ].join("\n");
    const out = finaliseLessonImport(old);
    expect(out.split("\n").filter((l) => l.trim()).slice(0, 4)).toEqual([
      "**Beginner Practice**",
      "**Question 1**",
      "Solve x+5<12.",
      "Solution 1",
    ]);
    expect(out).toContain("x≥2");
    expect(out).not.toMatch(RAW);
    expect(out).toContain("$x<3$");
    const nodes = aiTextToNodes(out, { sessionHeadings: true });
    const visible: string[] = [];
    walk(nodes, (n) => { if (n.type === "text") visible.push(n.text ?? ""); });
    expect(visible.join(" ")).not.toMatch(/[$\\]/);
  });
});

describe("Markdown export 6.1.2 inequalities", () => {
  it("preserve arranges it without the model and keeps the teacher's words", () => {
    const arranged = arrangePreservePaste(INEQUALITIES);
    expect(arranged, "deterministic arrange returned null").toBeTruthy();
    const note = arranged ?? "";
    const defects = verifyPreserveContent(INEQUALITIES, note);
    expect(defects, defects.join("\n")).toEqual([]);
    expect(preserveContentCollapsed(INEQUALITIES, note)).toBe(false);
    expect(note).not.toMatch(RAW);
    expect(finaliseLessonImport(note)).toBe(note);
  });

  it("finalise (Generate and Preserve) builds classroom sessions and renders the maths", () => {
    const note = finaliseLessonImport(INEQUALITIES);
    expect(lessonShape(note)).toBe(true);
    expect(finaliseLessonImport(note)).toBe(note);

    const nodes = aiTextToNodes(note, { sessionHeadings: true });
    const headings = nodes.filter((n) => n.type === "heading").map((n) => textOf(n));
    expect(headings[0]).toBe("6.1.2 INEQUALITY NOTATION AND LINEAR INEQUALITIES");
    expect(headings).toContain("V1. Beginner/JSS");
    expect(headings).toContain("Question V1");
    expect(headings.filter((h) => h === "Question V1")).toHaveLength(1);
    expect(headings).toContain("Beginner practice");
    expect(headings).toContain("Intermediate practice");
    expect(headings).toContain("Expert practice");
    const q = headings.indexOf("Question V1");
    expect(headings.slice(q + 1).some((h) => h.startsWith("Solution"))).toBe(true);

    const visible: string[] = [];
    const math: string[] = [];
    let numberLines = 0;
    let mono = 0;
    walk(nodes, (n) => {
      if (n.type === "text") visible.push(n.text ?? "");
      if (n.type === "mathInline" || n.type === "mathBlock") math.push(String(n.attrs?.value ?? ""));
      if (n.type === "mathVisual" && n.attrs?.family === "numberline") numberLines += 1;
      if (n.type === "codeBlock") mono += 1;
    });
    const shown = visible.join("\n");
    expect(shown).not.toMatch(RAW);
    expect(shown).not.toMatch(/\\(?:ge|le|boxed|dfrac)\b/);
    expect(math.join("\n")).toMatch(/\\frac\{15\}\{3\}/);
    expect(math.join("\n")).toMatch(/\\begin\{cases\}/);
    expect(numberLines).toBeGreaterThan(10);
    expect(mono).toBeGreaterThan(0);
    expect(shown).toContain("13/3");

    const question = nodes.find((n) => n.type === "paragraph" && textOf(n).includes("Solve and represent the real solutions"));
    expect(question?.type).toBe("paragraph");
    expect(textOf(question).startsWith("Solve and represent")).toBe(true);
  });
});

function textOf(n: any): string {
  if (!n) return "";
  if (typeof n.text === "string") return n.text;
  if (n.type === "mathInline" || n.type === "mathBlock") return String(n.attrs?.value ?? "");
  if (Array.isArray(n.content)) return n.content.map(textOf).join("");
  return "";
}

function lessonShape(note: string): boolean {
  const lines = note.split("\n").map((l) => l.trim()).filter(Boolean);
  if (RAW.test(note)) return false;
  if (!lines[0].startsWith("**6.1.2")) return false;
  const labels = lines.filter((l) => /^\*\*Question .+?\*\*$/.test(l) || /^Solution \d+$/.test(l));
  for (let i = 0; i < labels.length; ) {
    if (!labels[i].startsWith("**Question")) return false;
    if (labels[i + 1] && !labels[i + 1].startsWith("Solution")) return false;
    i += labels[i + 1]?.startsWith("Solution") ? 2 : 1;
  }
  return lines.some((l) => l === "**V1. Beginner/JSS**")
    && lines.some((l) => l === "**Beginner practice**")
    && lines.some((l) => l === "**Intermediate practice**")
    && lines.some((l) => l === "**Expert practice**")
    && lines.filter((l) => l === "**Question V1**").length === 1;
}
