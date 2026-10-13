import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewLessonDraft, draftDigest, type LessonDraft } from "../guide/lessonDraft";
import { draftInputSchema } from "../guide/lessonSchema";
import { z } from "zod";
import { authoringKnowledgeBlocks, CHATGPT_AUTHORING_STANDARD } from "../guide/authoringKnowledge";
import { GUIDE_VERSION, OPERATING_GUIDE } from "../guide/operatingGuide";
import { PEDAGOGY_REFERENCE } from "../../../../supabase/functions/notebook-ai/pedagogyReference.ts";
import { EDUCATIONAL_RECONSTRUCTION_STANDARD } from "../../../../supabase/functions/notebook-ai/workspaceStandard.ts";
import previewTool from "../tools/preview-structured-lesson";
import saveTool from "../tools/save-structured-lesson";
import createTool from "../tools/create-notebook";
import updateTool from "../tools/update-notebook";

const fixtures = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn(), insert: vi.fn(), from: vi.fn(), refresh: vi.fn() }));
vi.mock("../supabase-user", async importOriginal => ({
  ...await importOriginal<typeof import("../supabase-user")>(), requireUser: fixtures.auth,
}));
vi.mock("@/lib/agent/tools.server", () => ({ executeAgentTool: fixtures.execute }));
vi.mock("../live", () => ({ sendLiveCommand: fixtures.refresh }));

const handler = (tool: unknown) => (tool as { handler: (input: any, ctx: any) => Promise<any> }).handler;
function draft(): LessonDraft {
  return { title: "Linear equations", subject: "Mathematics", subtopic: "One-step equations", className: "Year 7",
    expectedCounts: { explanation: 1, example: 1, exercise: 0, classwork: 0 },
    sections: [
      { kind: "explanation", lines: ["An equation balances two equal quantities.", "Divide both sides by the same nonzero number to keep it balanced."] },
      { kind: "example", questions: [{ question: "Solve 2x = 6", solution: ["Solve 2x = 6", "Divide both sides by 2 to isolate x", "x = 3"],
        checks: [{ kind: "equation_solution", equation: "2x = 6", variable: "x", value: "3", answerLine: 3 }] }] },
    ] };
}
function question(d: LessonDraft) {
  const s = d.sections[1];
  if (!("questions" in s)) throw new Error("fixture is not a question section");
  return s.questions[0];
}
function proofDraft() {
  const d = draft(); const q = question(d);
  q.question = "Prove that an even integer has an even square";
  q.solution = [q.question, "Write the even integer as 2k", "Its square is 4k², which is twice 2k²", "The square is therefore even"];
  q.checks = [];
  return d;
}

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.auth.mockResolvedValue({ userId: "teacher-a", client: { from: fixtures.from } });
  fixtures.from.mockImplementation(() => ({ insert: fixtures.insert, select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }));
  fixtures.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "note-a" }, error: null }) }) });
  fixtures.execute.mockImplementation(async (_ctx, tool) => tool === "inspect_lesson_structure"
    ? { ok: true, data: { problems: [] } } : { ok: true, data: { sectionId: "section-a", subsectionId: "question-a" } });
  fixtures.refresh.mockResolvedValue({ ok: true });
});

describe("direct authoring knowledge", () => {
  it("supplies both teaching and reconstruction knowledge directly", () => {
    const blocks = authoringKnowledgeBlocks();
    expect(blocks).toContain(PEDAGOGY_REFERENCE);
    expect(blocks).toContain(EDUCATIONAL_RECONSTRUCTION_STANDARD);
    expect(blocks).toContain(CHATGPT_AUTHORING_STANDARD);
    expect(OPERATING_GUIDE).toContain("preview_structured_lesson");
    expect(CHATGPT_AUTHORING_STANDARD).toContain("Do not ask Copilot or AI Edit");
  });
  it("gates subject knowledge and supports smaller knowledge retrieval", () => {
    expect(authoringKnowledgeBlocks("Physics").join("\n")).toContain("PHYSICS");
    expect(authoringKnowledgeBlocks("Chemistry").join("\n")).toContain("CHEMISTRY");
    expect(authoringKnowledgeBlocks("Mathematics", "teaching")).not.toContain(EDUCATIONAL_RECONSTRUCTION_STANDARD);
    expect(authoringKnowledgeBlocks("Mathematics", "reconstruction")).not.toContain(PEDAGOGY_REFERENCE);
  });
});

describe("draft review", () => {
  it("checks a displayed answer against the actual equation", () => {
    const r = reviewLessonDraft(draft());
    expect(r.ok).toBe(true);
    expect(r.mathematics).toBe("checked_answers");
    expect(r.checks[0]).toMatchObject({ passed: true, exact: true });
  });
  it("rejects the previously accepted incorrect x = 4", () => {
    const d = draft(); const q = question(d); q.solution[2] = "x = 4";
    q.checks![0].value = "4";
    expect(reviewLessonDraft(d).problems.some(p => p.issue.includes("does not satisfy"))).toBe(true);
  });
  it("cannot check the right value and display the wrong value", () => {
    const d = draft(); question(d).solution[2] = "x = 4";
    expect(reviewLessonDraft(d).problems.some(p => p.issue.includes("displayed final answer"))).toBe(true);
  });
  it("preserves the identity of uppercase and lowercase variables", () => {
    const d = draft(); question(d).solution[2] = "X = 3";
    expect(reviewLessonDraft(d).ok).toBe(false);
  });
  it("cannot verify a partial equation hidden inside a different equation", () => {
    const d = draft(); const q = question(d); q.question = "Solve 12x = 6"; q.solution[0] = q.question;
    expect(reviewLessonDraft(d).ok).toBe(false);
    q.question = "Solve 2x = 6 + 2"; q.solution[0] = q.question;
    expect(reviewLessonDraft(d).ok).toBe(false);
  });
  it("cannot verify just one term of a longer arithmetic question", () => {
    const d = draft(); const q = question(d); q.question = "Evaluate 2 + 3 × 4";
    q.solution = [q.question, "Multiply the selected numbers", "3 × 4 = 12"];
    q.checks = [{ kind: "arithmetic", expression: "3 × 4", value: "12", answerLine: 3 }];
    expect(reviewLessonDraft(d).ok).toBe(false);
  });
  it("rejects an unrelated check, a changed inequality and a bare Done", () => {
    const d = draft(); const q = question(d);
    q.checks![0] = { kind: "equation_solution", equation: "3x = 9", variable: "x", value: "3", answerLine: 3 };
    expect(reviewLessonDraft(d).ok).toBe(false);
    q.question = "Solve x > 3"; q.solution = ["Solve x < 3", "Use the stated inequality condition", "x < 3"]; q.checks = [];
    expect(reviewLessonDraft(d).problems.some(p => p.issue.includes("inequality signs"))).toBe(true);
    q.question = "Solve 2x = 6"; q.solution = [q.question, "Done"];
    expect(reviewLessonDraft(d).ok).toBe(false);
  });
  it("makes unsupported maths visible rather than marking it verified", () => {
    const d = proofDraft();
    const r = reviewLessonDraft(d);
    expect(r.ok).toBe(true);
    expect(r.mathematics).toBe("needs_teacher_review");
    expect(r.reviewRequired.length).toBeGreaterThan(0);
  });
  it("automatically checks simple equations even when claims are omitted", () => {
    const d = draft(); const q = question(d); q.checks = [];
    expect(reviewLessonDraft(d).mathematics).toBe("checked_answers");
    q.solution[2] = "x = 4";
    expect(reviewLessonDraft(d).mathematics).toBe("failed");
    expect(reviewLessonDraft(d).ok).toBe(false);
  });
  it("does not equate one correct quadratic root with a complete solution", () => {
    const d = draft(); const q = question(d); q.question = "Solve x² = 4";
    q.solution = [q.question, "Take a square root of both sides", "x = 2"];
    q.checks = [{ kind: "equation_solution", equation: "x² = 4", variable: "x", value: "2", answerLine: 3 }];
    const r = reviewLessonDraft(d);
    expect(r.ok).toBe(true); expect(r.checks[0].passed).toBe(true);
    expect(r.mathematics).toBe("needs_teacher_review");
  });
  it("flags mathematical teaching prose that has no answer checks", () => {
    const d = draft(); d.sections[0] = { kind: "explanation", lines: ["2 + 3 = 6"] };
    expect(reviewLessonDraft(d).mathematics).toBe("needs_teacher_review");
  });
  it("counts questions rather than outer headings and respects zero counts", () => {
    const d = draft(); const s = d.sections[1]; if (!("questions" in s)) throw new Error();
    s.questions.push(structuredClone(s.questions[0]));
    expect(reviewLessonDraft(d).problems).toContainEqual({ where: "lesson counts", issue: "example: requested 1, produced 2" });
    d.sections.push({ kind: "classwork", questions: [structuredClone(s.questions[0])] });
    expect(reviewLessonDraft(d).problems.some(p => p.issue === "classwork: requested 0, produced 1")).toBe(true);
  });
  it("rejects unsupported objects and calculator fractions", () => {
    const d = draft(); question(d).question = "Evaluate 1/2";
    expect(reviewLessonDraft(d).ok).toBe(false);
    d.sections[0] = { kind: "explanation", lines: ['[[tool:smartTable headers="x | f"]]'] };
    expect(reviewLessonDraft(d).problems.some(p => p.issue.includes("unsupported native-object"))).toBe(true);
  });
  it("checks constant arithmetic with the actual final result", () => {
    const d = draft(); const q = question(d); q.question = "Evaluate 2 + 3";
    q.solution = [q.question, "Add the two numbers together", "2 + 3 = 5"];
    q.checks = [{ kind: "arithmetic", expression: "2 + 3", value: "5", answerLine: 3 }];
    expect(reviewLessonDraft(d).mathematics).toBe("checked_answers");
    if (q.checks[0].kind !== "arithmetic") throw new Error("not an arithmetic check");
    q.checks[0].expression = 'import("bad")';
    expect(reviewLessonDraft(d).ok).toBe(false);
  });
  it("prevents wrong section shapes from silently losing content", () => {
    const input = z.object(draftInputSchema);
    expect(input.safeParse({ ...draft(), sections: [{ kind: "example", lines: ["lost content"] }] }).success).toBe(false);
    expect(input.safeParse({ ...draft(), sections: [{ kind: "explanation", lines: ["text"], questions: [] }] }).success).toBe(false);
  });
  it("binds approval to every line, count, target and cover field", async () => {
    const d = draft(); const digest = await draftDigest(d);
    expect(await draftDigest(structuredClone(d))).toBe(digest);
    for (const change of [(x: LessonDraft) => { x.className = "Year 8"; }, (x: LessonDraft) => { x.expectedCounts!.example = 2; },
      (x: LessonDraft) => { question(x).solution[1] = "A different explanation"; }, (x: LessonDraft) => { x.notebookId = "another-note"; }]) {
      const changed = structuredClone(d); change(changed); expect(await draftDigest(changed)).not.toBe(digest);
    }
  });
});

describe("preview and approved save", () => {
  it("preview writes nothing and does not authenticate against a database", async () => {
    const r = await handler(previewTool)({ guideVersion: GUIDE_VERSION, ...draft() }, {});
    expect(r.structuredContent).toMatchObject({ saved: false, ok: true, mathematics: "checked_answers" });
    expect(r.structuredContent.approvalDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(fixtures.auth).not.toHaveBeenCalled(); expect(fixtures.execute).not.toHaveBeenCalled();
  });
  it("rejects an invalid preview and a stale guide", async () => {
    const d = draft(); question(d).solution[2] = "x = 4";
    const r = await handler(previewTool)({ guideVersion: GUIDE_VERSION, ...d }, {});
    expect(r.isError).toBe(true); expect(r.structuredContent.approvalDigest).toBeNull();
    expect((await handler(previewTool)({ guideVersion: "old", ...draft() }, {})).isError).toBe(true);
  });
  it("requires approval and the unchanged preview before any write", async () => {
    const d = draft(); const approvalDigest = await draftDigest(d);
    expect((await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d }, {})).isError).toBe(true);
    expect((await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest: "0".repeat(64) }, {})).isError).toBe(true);
    d.className = "Year 8";
    expect((await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest }, {})).isError).toBe(true);
    expect(fixtures.auth).not.toHaveBeenCalled(); expect(fixtures.insert).not.toHaveBeenCalled();
  });
  it("cannot save failed mathematics even with a correct digest and approval", async () => {
    const d = draft(); question(d).solution[2] = "x = 4"; question(d).checks![0].value = "4";
    const r = await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest: await draftDigest(d) }, {});
    expect(r.isError).toBe(true); expect(fixtures.auth).not.toHaveBeenCalled();
  });
  it("requires explicit teacher maths review for unsupported content", async () => {
    const d = proofDraft();
    const input = { guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest: await draftDigest(d) };
    expect((await handler(saveTool)(input, {})).isError).toBe(true);
    expect(fixtures.auth).not.toHaveBeenCalled();
    const saved = await handler(saveTool)({ ...input, teacherReviewConfirmed: true }, {});
    expect(saved.structuredContent).toMatchObject({ saved: true, structureVerified: true, verified: false, teacherReviewed: true, mathematics: "needs_teacher_review" });
  });
  it("saves the author's own lines and preserves class metadata without invoking AI", async () => {
    const d = draft(); const r = await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest: await draftDigest(d) }, {});
    expect(r.structuredContent).toMatchObject({ saved: true, structureVerified: true, mathematics: "checked_answers" });
    expect(fixtures.insert).toHaveBeenCalledWith(expect.objectContaining({ class_name: "Year 7", owner_id: "teacher-a" }));
    expect(fixtures.execute).toHaveBeenCalledWith(expect.anything(), "write_question", expect.objectContaining({ question: "Solve 2x = 6", solution: question(d).solution }));
    expect(fixtures.execute.mock.calls.some(([, tool]) => /generate|copilot|ai_edit/.test(tool))).toBe(false);
  });
  it("preserves owner-scoping for an existing notebook", async () => {
    const d = draft(); d.notebookId = "11111111-0000-4000-8000-000000000001";
    const r = await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest: await draftDigest(d) }, {});
    expect(r.isError).toBe(true); expect(fixtures.execute).not.toHaveBeenCalled();
  });
  it("does not turn a failed structure read-back into verified success", async () => {
    fixtures.execute.mockImplementation(async (_ctx, tool) => tool === "inspect_lesson_structure"
      ? { ok: false, error: "read failed" } : { ok: true, data: { sectionId: "section-a" } });
    const d = draft(); const r = await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest: await draftDigest(d) }, {});
    expect(r.structuredContent).toMatchObject({ saved: true, structureVerified: false, verified: false });
  });
  it("blocks legacy content writes before authentication or mutation", async () => {
    const sections = [{ kind: "explanation", blocks: [{ kind: "text", content: "bypass" }] }];
    expect((await handler(createTool)({ title: "Bypass", subject: "Mathematics", subtopic: "", className: "", teacher: "", sections }, {})).isError).toBe(true);
    expect((await handler(updateTool)({ id: "note-a", appendSections: sections }, {})).isError).toBe(true);
    expect(fixtures.auth).not.toHaveBeenCalled();
  });
  it("reports partial writes without suggesting resending the whole draft", async () => {
    fixtures.execute.mockImplementation(async (_ctx, tool) => tool === "append_lesson_lines"
      ? { ok: false, error: "write failed" } : { ok: true, data: { sectionId: "section-a" } });
    const d = draft(); const r = await handler(saveTool)({ guideVersion: GUIDE_VERSION, ...d, confirmed: true, approvalDigest: await draftDigest(d) }, {});
    expect(r.isError).toBe(true); expect(r.structuredContent.savedSections).toHaveLength(1);
    expect(r.content[0].text).toContain("do not resend the whole lesson");
  });
});
