// Regression: two lines of one question carrying the SAME source line id.
// Uses the production compiler (compileSectionQuestions) with a mocked DB and
// lesson source, then the production server lookup (findKeyLine/expectedAscii
// from supabase/functions/_shared) and the server's deterministicVerdict.
// SYNTHETIC fixture modelled on "Identify the base and index in 2^{5}." —
// NOT the stored production record (not accessible).
import { describe, expect, it, vi } from "vitest";

vi.mock("npm:mathjs@12", async () => await import("mathjs"));

const SID = "sub-index-notation";
const DUP = "hl_legacy_1_dup";
let reservoirLines: any[] = [];
const fragments = ["2^5", "=", "2", "×", "2", "×", "2", "×", "2", "×", "2", "2", "=", "base"];

const q = (rows: unknown) => {
  const o: any = {
    select: () => o, eq: () => o, in: () => o, order: () => o,
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null }),
    then: (r: any) => Promise.resolve({ data: rows, error: null }).then(r),
  };
  return o;
};
vi.mock("@/lib/db/scope", () => ({
  db: () => ({
    from: (t: string) => {
      if (t === "notebook_sections") return q({ id: "sec", notebook_id: "nb", kind: "exercise", title: "Index notation", order_index: 0 });
      if (t === "notebook_subsections") return q([{ id: SID, section_id: "sec", order_index: 0 }]);
      if (t === "notebook_blocks") return q([{ id: "b", subsection_id: SID, kind: "problem", content_ascii: "Identify the base and index in 2^{5}." }]);
      return q([]);
    },
  }),
}));
vi.mock("@/lib/smartboard/presentation", () => ({
  buildLessonBoardSource: () => ({
    beats: [{ id: `${SID}-q`, objects: [] }],
    reservoirs: [{ beatId: `${SID}-q`, fragments, lines: reservoirLines }],
  }),
}));

const { compileSectionQuestions, uniqueLineId } = await import("@/lib/assessments/createAssessment");
const { findKeyLine, expectedAscii } = (await import(/* @vite-ignore */ `${process.cwd()}/supabase/functions/_shared/answerKeyLookup.ts`)) as any;
const { deterministicVerdict } = (await import(/* @vite-ignore */ `${process.cwd()}/supabase/functions/_shared/mathEquivalence.ts`)) as any;

const FIVE = "2^5 = 2×2×2×2×2";
const FOUR = "2^5 = 2×2×2×2";

describe("duplicate source line ids → answer key pairing (production compiler + server lookup)", () => {
  it("each board line resolves to its OWN key; five factors pass, four rejected", async () => {
    reservoirLines = [
      { lineId: DUP, equation: "base = 2", fragmentStart: 11, fragmentEnd: 14, marks: 1 },
      { lineId: DUP, equation: FIVE, fragmentStart: 0, fragmentEnd: 11, marks: 2 },
    ];
    const c = await compileSectionQuestions("sec");
    const ids = c.questions[0].lines.map((l) => l.lineId);
    expect(new Set(ids).size).toBe(2);
    expect(c.answerKey.map((k) => k.lineId)).toEqual(ids);
    const key = findKeyLine(c.answerKey as any, SID, ids[1])!;
    expect(deterministicVerdict(expectedAscii(key), FIVE)).toBe("equal");
    expect(deterministicVerdict(expectedAscii(key), FOUR)).not.toBe("equal");
  });

  it("pre-fix pairing (raw duplicate ids) grades the five-factor line against line 1 — the bug", () => {
    const rawKey = [
      { questionId: SID, lineId: DUP, tokens: [], equationAscii: "base = 2" },
      { questionId: SID, lineId: DUP, tokens: [], equationAscii: FIVE },
    ];
    const hit = findKeyLine(rawKey, SID, DUP)!;
    expect(deterministicVerdict(expectedAscii(hit), FIVE)).not.toBe("equal");
  });

  it("never collides with a pre-existing '~2' id in the same question", async () => {
    reservoirLines = [
      { lineId: DUP, equation: "base = 2", fragmentStart: 11, fragmentEnd: 14, marks: 1 },
      { lineId: DUP, equation: FIVE, fragmentStart: 0, fragmentEnd: 11, marks: 2 },
      { lineId: `${DUP}~2`, equation: "index = 5", fragmentStart: 11, fragmentEnd: 14, marks: 1 },
    ];
    const c = await compileSectionQuestions("sec");
    const ids = c.questions[0].lines.map((l) => l.lineId);
    expect(ids).toEqual([DUP, `${DUP}~3`, `${DUP}~2`]);
    expect(expectedAscii(findKeyLine(c.answerKey as any, SID, `${DUP}~3`)!)).toContain("2×2");
  });

  it("uniqueLineId: unique for all orders incl. pre-existing suffixes", () => {
    const raw = [`a~2`, "a", "a", "a~2", "a"];
    const used = new Set<string>();
    const out = raw.map((r) => uniqueLineId(used, r, new Set(raw)));
    expect(new Set(out).size).toBe(raw.length);
    expect(out.slice(0, 2)).toEqual(["a~2", "a"]);
  });
});
