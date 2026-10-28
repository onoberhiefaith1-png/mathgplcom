import { describe, expect, it } from "vitest";

import { findAgentTool } from "../toolTypes";
import { executeAgentTool } from "../tools.server";
import { buildAgentSystemPrompt } from "../systemPrompt";
import { findKnowledge } from "../knowledge";

/** Minimal stand-in for the teacher's database client. */
function fakeDb(sectionKind: string) {
  const inserted: any[] = [];
  const api = (table: string) => {
    const chain: any = {
      _table: table,
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: [] }),
      maybeSingle: () =>
        Promise.resolve({ data: table === "notebook_sections" ? { id: "s1", kind: sectionKind } : null }),
      single: () => Promise.resolve({ data: { id: table === "notebook_sections" ? "s1" : "sub1" } }),
      insert: (rows: any) => {
        inserted.push(...(Array.isArray(rows) ? rows : [rows]));
        return chain;
      },
    };
    return chain;
  };
  return { db: { from: api, rpc: () => Promise.resolve({ data: null }) }, inserted };
}

describe("a question and its solution live in one session", () => {
  it("refuses loose prose inside an Example section", async () => {
    const { db } = fakeDb("example");
    const res = await executeAgentTool({ supabase: db as never, userId: "t1" }, "append_lesson_lines", {
      sectionId: "s1",
      lines: ["Example 1: simplify 2x + 3x — solved"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("write_question");
  });

  it("still writes prose into an Explanation section", async () => {
    const { db, inserted } = fakeDb("explanation");
    const res = await executeAgentTool({ supabase: db as never, userId: "t1" }, "append_lesson_lines", {
      sectionId: "s1",
      lines: ["Like terms are terms with the same letter."],
    });
    expect(res.ok).toBe(true);
    expect(inserted[0].kind).toBe("text");
  });

  it("writes the question as the question and the steps as its solution", () => {
    const tool = findAgentTool("write_question");
    expect(tool).toBeTruthy();
    expect(tool?.readOnly).toBe(false);
    const names = (tool?.params ?? []).map((p) => p.name);
    expect(names).toContain("question");
    expect(names).toContain("solution");
    expect(tool?.description).toContain("session");
  });

  it("explains to her why the structure is needed", () => {
    const prompt = buildAgentSystemPrompt();
    expect(prompt).toContain("write_question");
    expect(prompt).toContain("An Example is not a line of text");
    expect(prompt).toMatch(/Floating Numbers need it/);
    expect(prompt).toMatch(/Two worked examples are two sessions/);
    const known = findKnowledge("lesson-sections");
    expect(known?.pitfalls.join(" ")).toMatch(/Two worked examples are two sessions/);
  });
});
