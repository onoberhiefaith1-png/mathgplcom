import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { arrangeLessonSessions, sessionMarkerAt } from "../sessionArrange";
import { aiTextToNodes } from "../aiToNodes";
import { buildLessonOutline } from "../lessonOutline";
import { arrangePreservePaste } from "../../../../supabase/functions/notebook-ai/preserveContentArrange";
import { verifyPreserveContent } from "../../../../supabase/functions/notebook-ai/preserveContentVerifier";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/session-3.1.1-solutions.md", import.meta.url)),
  "utf8",
);

const lines = (s: string) => s.split("\n").filter((l) => l.trim());
const outline = (text: string) =>
  buildLessonOutline({ type: "doc", content: aiTextToNodes(text, { sessionHeadings: true }) });

describe("session markers", () => {
  it("recognises question, solution, tier and practice markers", () => {
    expect(sessionMarkerAt("Question 1. Identify the base")).toMatchObject({ kind: "question", title: "Question 1", n: 1 });
    expect(sessionMarkerAt("**Example 2**")).toMatchObject({ kind: "question", title: "Example 2" });
    expect(sessionMarkerAt("Classwork 3")).toMatchObject({ kind: "question", n: 3 });
    expect(sessionMarkerAt("Solution")).toMatchObject({ kind: "solution" });
    expect(sessionMarkerAt("Beginner Practice")).toMatchObject({ kind: "group", title: "Beginner Practice" });
    expect(sessionMarkerAt("Practice")?.kind).toBe("label");
    expect(sessionMarkerAt("Solve 2x + 3 = 7")).toBeNull();
  });
});

describe("(a) the heading at the top is the first session", () => {
  it("lifts Beginner Practice to the top with the intro under it, word for word", () => {
    const out = arrangeLessonSessions(FIXTURE);
    const l = lines(out);
    expect(l[0]).toBe("**Beginner Practice**");
    expect(l[1].startsWith("Understood. I'll keep straightforward questions short")).toBe(true);
    expect(l[2]).toBe("3.1.1 — Index Notation as Repeated Multiplication");
    expect(l[3]).toBe("**Question 1**");
    expect(l[4]).toBe("Identify the base and index in \\(2^5\\).");
    expect(l[5]).toBe("Solution 1");
    expect(l[6]).toBe("Base = \\(2\\)");
    expect(l[8]).toBe("**Question 2**");
    expect(l[9]).toBe("Identify the base and index in \\(7^3\\).");
    // Nothing from the paste is dropped.
    for (const line of lines(FIXTURE)) {
      const core = line.replace(/^(Question \d+)\.\s*/, "").replace(/^Solution$/, "");
      if (core) expect(out).toContain(core);
    }
  });

  it("is idempotent", () => {
    const once = arrangeLessonSessions(FIXTURE);
    expect(arrangeLessonSessions(once)).toBe(once);
  });

  it("the arranged note opens with that session on the Smartboard", () => {
    const segs = outline(arrangeLessonSessions(FIXTURE));
    expect(segs[0]).toMatchObject({ title: "Beginner Practice", implicit: false });
    expect(segs[1].title).toBe("Question 1");
    expect(segs[2]).toMatchObject({ isSolution: true });
    expect(segs[3].title).toBe("Question 2");
  });

  it("a heading already at the top keeps its own text under it", () => {
    const out = arrangeLessonSessions("Practice\nWork through these.\nQuestion 1: Solve x + 1 = 3\nSolution\nx = 2");
    expect(lines(out).slice(0, 3)).toEqual(["**Practice**", "Work through these.", "**Question 1**"]);
  });

  it("the deterministic Preserve arranger emits bold sessions too", () => {
    const arranged = arrangePreservePaste(FIXTURE) ?? "";
    expect(lines(arranged)[0]).toBe("**Beginner Practice**");
    expect(arranged).toMatch(/^\*\*Question 1\*\*$/m);
    expect(verifyPreserveContent(FIXTURE, arranged)).toEqual([]);
  });
});

describe("(b) a question always comes before its solution", () => {
  it("moves a solution that came first under its question", () => {
    const out = arrangeLessonSessions("Solution 1\nx = 2\nQuestion 1: Solve x + 1 = 3");
    expect(lines(out)).toEqual(["**Question 1**", "Solve x + 1 = 3", "Solution 1", "x = 2"]);
  });

  it("pairs solutions grouped after all questions with their own question", () => {
    const out = arrangeLessonSessions(
      "Question 1\nSolve x + 1 = 3\nQuestion 2\nSolve 2x = 8\nSolution 1\nx = 2\nSolution 2\nx = 4",
    );
    expect(lines(out)).toEqual([
      "**Question 1**", "Solve x + 1 = 3", "Solution 1", "x = 2",
      "**Question 2**", "Solve 2x = 8", "Solution 2", "x = 4",
    ]);
  });

  it("a solution does not repeat its question", () => {
    const out = arrangeLessonSessions("Question 2\nSolve 2x = 8\nSolution\nSolve 2x = 8\nx = 4");
    expect(lines(out)).toEqual(["**Question 2**", "Solve 2x = 8", "Solution 2", "x = 4"]);
  });

  it("in the note the question session is before its solution session", () => {
    const segs = outline(arrangeLessonSessions("Solution 1\nx = 2\nQuestion 1: Solve x + 1 = 3"));
    expect(segs.map((s) => [s.title, s.isSolution])).toEqual([["Question 1", false], ["Solution 1", true]]);
  });
});

describe("(c) a session is invented when there is no marker", () => {
  it("invents Question 1 for a bare question", () => {
    const out = arrangeLessonSessions("Simplify 3a + 2a\n5a");
    expect(lines(out)[0]).toBe("**Question 1**");
    expect(out).toContain("Simplify 3a + 2a");
  });

  it("uses the segment's first question number", () => {
    const out = arrangeLessonSessions("Simplify 3a + 2a", { firstQuestion: 11 });
    expect(lines(out)[0]).toBe("**Question 11**");
  });

  it("invents Introduction above opening prose and keeps it", () => {
    const out = arrangeLessonSessions("Index notation is repeated multiplication.\n\nQuestion 1\nWrite 2 × 2 × 2 as a power.");
    expect(lines(out).slice(0, 3)).toEqual([
      "**Introduction**", "Index notation is repeated multiplication.", "**Question 1**",
    ]);
    expect(outline(out)[0]).toMatchObject({ kind: "introduction", implicit: false });
  });

  it("turns a bare numbered test into Question sessions", () => {
    const out = arrangeLessonSessions("1. Solve 2x + 3 = 7\nSolution\nx = 2\n\n2. Solve x + 1 = 4");
    expect(lines(out)).toEqual(["**Question 1**", "Solve 2x + 3 = 7", "Solution 1", "x = 2", "**Question 2**", "Solve x + 1 = 4"]);
  });

  it("keeps numbered working steps inside their solution", () => {
    const out = arrangeLessonSessions("Question 1\nSolve x + 1 = 3\nSolution\n1. x = 3 - 1\n2. x = 2");
    expect(out).toContain("1. x = 3 - 1\n2. x = 2");
    expect(out).not.toContain("**Question 2**");
  });
});
