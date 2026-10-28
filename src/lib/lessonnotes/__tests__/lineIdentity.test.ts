import { describe, it, expect } from "vitest";
import type { IdentifiedHighlight } from "@/lib/lessonnotes/lineIdentity";
import { adoptLineIdentities, ensureHighlightUids, linesByUid } from "@/lib/lessonnotes/lineIdentity";
import { validateQuestionStructure } from "@/lib/smartboard/previewIntegrity";

const highlights: IdentifiedHighlight[] = [
  { groupId: 1, payload: "", notebookOnly: true, precedingNotebook: "For" },
  { groupId: 2, payload: "2x^{2} + 5x - 3 = 0", precedingNotebook: "Compare with ax² + bx + c = 0:" },
  { groupId: 3, payload: "ax^{2} + bx + c = 0", precedingNotebook: "" },
];

describe("permanent line identity", () => {
  it("gives the same legacy uid to the same saved row on every read", () => {
    const a = ensureHighlightUids(highlights);
    const b = ensureHighlightUids(highlights);
    expect(a.map((h) => h.uid)).toEqual(b.map((h) => h.uid));
    expect(new Set(a.map((h) => h.uid)).size).toBe(3);
  });

  it("adopts legacy floating rows onto their own source line", () => {
    const lines = [
      { lineId: "l1", groupId: 2, equation: "2x^{2} + 5x - 3 = 0", fillers: ["a", "=2"] },
      { lineId: "l2", groupId: 3, equation: "ax^{2} + bx + c = 0", fillers: ["ax²", "+bx"] },
    ];
    const out = adoptLineIdentities(highlights, lines);
    const byUid = linesByUid(out.lines);
    const h2 = out.highlights[1].uid!;
    const h3 = out.highlights[2].uid!;
    expect(byUid.get(h2)?.equation).toBe("2x^{2} + 5x - 3 = 0");
    expect(byUid.get(h3)?.equation).toBe("ax^{2} + bx + c = 0");
    expect(validateQuestionStructure(out.highlights, out.lines).ok).toBe(true);
  });

  it("reports a structure error instead of guessing when identity is missing", () => {
    const report = validateQuestionStructure(ensureHighlightUids(highlights), [
      { equation: "x = 2", fillers: ["x", "=2"] },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues[0].kind).toBe("missing_identity");
  });

  it("reports two chip sets claiming the same line", () => {
    const withUids = ensureHighlightUids(highlights);
    const uid = withUids[1].uid!;
    const report = validateQuestionStructure(withUids, [
      { sourceUid: uid, equation: "a", fillers: ["a"] },
      { sourceUid: uid, equation: "a", fillers: ["b"] },
    ]);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.kind === "duplicate_claim")).toBe(true);
  });
});
