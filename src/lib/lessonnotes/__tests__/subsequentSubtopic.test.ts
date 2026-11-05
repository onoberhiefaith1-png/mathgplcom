import { describe, expect, it } from "vitest";
import { composeSessionNodes, subtopicTitleFromArranged } from "../subsequentSubtopic";
import { arrangeLessonSessions } from "../sessionArrange";

const textOf = (n: any): string => {
  if (!n) return "";
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return n.content.map(textOf).join("");
  return "";
};

const headings = (nodes: any[]) =>
  nodes.filter((n) => n.type === "heading").map((n) => ({ level: n.attrs?.level, text: textOf(n) }));

const empty = { type: "doc", content: [{ type: "paragraph" }] };

const indicesNote = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Indices" }] },
    { type: "heading", attrs: { level: 3, sessionKind: "exercise" }, content: [{ type: "text", text: "Question 1" }] },
    { type: "paragraph", content: [{ type: "text", text: "Write 2 × 2 × 2 as a power." }] },
    { type: "heading", attrs: { level: 3, sessionKind: "exercise" }, content: [{ type: "text", text: "Question 2" }] },
    { type: "paragraph", content: [{ type: "text", text: "Write 3 × 3 as a power." }] },
  ],
};

const logarithms = [
  "Logarithms",
  "1. Simplify log 8",
  "2. Expand log (4x)",
  "3. Evaluate log 100",
].join("\n");

describe("a later question set in the same note becomes a subtopic", () => {
  it("the first paste with no clear heading stays an Introduction session", () => {
    const nodes = composeSessionNodes(logarithms, empty);
    expect(headings(nodes)[0]).toEqual({ level: 3, text: "Introduction" });
    expect(nodes.some((n) => textOf(n) === "Logarithms")).toBe(true);
    expect(nodes.some((n) => textOf(n) === "Question 1")).toBe(true);
    expect(headings(nodes).some((h) => h.level === 1)).toBe(false);
  });

  it("a second questions 1–n paste puts the topic name on top as a subtopic", () => {
    const nodes = composeSessionNodes(logarithms, indicesNote);
    expect(headings(nodes)[0]).toEqual({ level: 1, text: "Logarithms" });
    expect(headings(nodes).some((h) => h.text === "Introduction")).toBe(false);
    expect(headings(nodes).map((h) => h.text)).toEqual([
      "Logarithms",
      "Question 1",
      "Question 2",
      "Question 3",
    ]);
    expect(nodes.some((n) => textOf(n) === "Simplify log 8")).toBe(true);
    expect(nodes.some((n) => textOf(n) === "Evaluate log 100")).toBe(true);
  });

  it("a bold topic heading on a later paste is promoted, not flattened", () => {
    const paste = "**Sequences**\n1. Find the next term\n2. Find the nth term";
    const nodes = composeSessionNodes(paste, indicesNote);
    expect(headings(nodes)[0]).toEqual({ level: 1, text: "Sequences" });
    expect(headings(nodes).some((h) => h.text === "Question 1")).toBe(true);
  });

  it("a single follow-up question is not wrapped as a new subtopic", () => {
    const nodes = composeSessionNodes("Solve x + 1 = 4", indicesNote);
    expect(headings(nodes).some((h) => h.level === 1)).toBe(false);
  });

  it("lifts a plain topic line out from under Introduction", () => {
    const arranged = arrangeLessonSessions(logarithms);
    expect(arranged.startsWith("**Introduction**")).toBe(true);
    expect(subtopicTitleFromArranged(arranged)).toBe("Logarithms");
  });
});
