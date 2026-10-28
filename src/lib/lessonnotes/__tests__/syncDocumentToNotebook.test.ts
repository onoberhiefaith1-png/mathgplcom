import { describe, it, expect } from "vitest";
import {
  claimSectionsForEntries,
  matchSubsectionsForSection,
  type MatchableSection,
  type MatchableSub,
} from "@/lib/lessonnotes/syncDocumentToNotebook";

// Two saved questions. Each already carries a doc_key from a prior save (the
// normal state of any previously-saved notebook) and holds real Floating
// Numbers state — represented here by the row itself, since matching only
// decides WHICH row a question keeps.
const sub = (
  id: string,
  problem: string,
  docKey: string | null,
  extra: Partial<MatchableSub> = {},
): MatchableSub => ({ id, problem, solution: "", doc_key: docKey, doc_section_id: null, ...extra });

const section = (
  id: string,
  problem: string,
  docKey: string | null,
  extra: { docSectionId?: string | null; solution?: string } = {},
): MatchableSection => ({
  id,
  kind: "example",
  doc_key: docKey,
  doc_section_id: extra.docSectionId ?? null,
  subs: [
    sub(`row-${id}`, problem, docKey, {
      solution: extra.solution ?? "",
      doc_section_id: extra.docSectionId ?? null,
    }),
  ],
});

const twoSections = (withIds = false) => [
  section("sec-A", "Solve 2x + 5 = 17", "3:example:0", { docSectionId: withIds ? "q-alpha" : null }),
  section("sec-B", "Factorise x^2 - 5x + 6", "3:example:1", { docSectionId: withIds ? "q-beta" : null }),
];

const entry = (
  problem: string,
  docKey: string,
  extra: { docSectionId?: string | null; solution?: string } = {},
) => ({ dbKind: "example", docKey, problem, ...extra });

describe("claimSectionsForEntries — a question keeps its own saved row", () => {
  it("swap: reclaims each section by its own unchanged question text", () => {
    const existing = twoSections();
    const [first, second] = claimSectionsForEntries(existing, new Set(existing.map((e) => e.id)), [
      entry("Factorise x^2 - 5x + 6", "3:example:0"),
      entry("Solve 2x + 5 = 17", "3:example:1"),
    ]);
    expect(first?.id).toBe("sec-B");
    expect(second?.id).toBe("sec-A");
  });

  it("inserting a new question above must not steal an existing question's row", () => {
    const existing = twoSections();
    // The new question sits at position 0, so its key equals row-A's stale key.
    const [inserted, movedA, movedB] = claimSectionsForEntries(
      existing,
      new Set(existing.map((e) => e.id)),
      [
        entry("A brand new inserted question", "3:example:0"),
        entry("Solve 2x + 5 = 17", "3:example:1"),
        entry("Factorise x^2 - 5x + 6", "3:example:2"),
      ],
    );
    expect(inserted).toBeNull();
    expect(movedA?.id).toBe("sec-A");
    expect(movedB?.id).toBe("sec-B");
  });

  it("a re-worded question that stayed in place still keeps its row by doc_key", () => {
    const existing = twoSections();
    const [first, second] = claimSectionsForEntries(existing, new Set(existing.map((e) => e.id)), [
      entry("Solve 2x + 5 = 19 (reworded)", "3:example:0"),
      entry("Factorise x^2 - 5x + 6", "3:example:1"),
    ]);
    expect(first?.id).toBe("sec-A");
    expect(second?.id).toBe("sec-B");
  });

  it("a question whose problem changed keeps its row when its solution is unchanged", () => {
    const existing = [
      section("sec-A", "Solve 2x + 5 = 17", "3:example:0", { solution: "x = 6" }),
      section("sec-B", "Factorise x^2 - 5x + 6", "3:example:1", { solution: "(x-2)(x-3)" }),
    ];
    // Both were re-worded AND moved past each other, so neither key nor text
    // agrees; only the solution text still identifies them.
    const [first, second] = claimSectionsForEntries(existing, new Set(existing.map((e) => e.id)), [
      entry("Factorise the quadratic below", "9:example:0", { solution: "(x-2)(x-3)" }),
      entry("Find x in the equation", "9:example:1", { solution: "x = 6" }),
    ]);
    // Positional keys don't match (9:example:*), text doesn't match, solutions do.
    expect(first?.id).toBe("sec-B");
    expect(second?.id).toBe("sec-A");
  });

  it("still leaves a genuinely removed question unclaimed", () => {
    const existing = twoSections();
    const unclaimed = new Set(existing.map((e) => e.id));
    claimSectionsForEntries(existing, unclaimed, [entry("Solve 2x + 5 = 17", "3:example:0")]);
    expect([...unclaimed]).toEqual(["sec-B"]);
  });
});

describe("permanent heading id — the case text and position cannot recover", () => {
  it("a question that is BOTH re-worded AND moved keeps its row and its Floating Numbers", () => {
    const existing = twoSections(true);
    // q-alpha was re-worded and dragged below q-beta; a new question took its spot.
    const [fresh, beta, alpha] = claimSectionsForEntries(
      existing,
      new Set(existing.map((e) => e.id)),
      [
        entry("A brand new question", "3:example:0", { docSectionId: "q-new" }),
        entry("Factorise x^2 - 5x + 6", "3:example:1", { docSectionId: "q-beta" }),
        entry("Solve 2x + 5 = 19, showing every step", "3:example:2", { docSectionId: "q-alpha" }),
      ],
    );
    expect(alpha?.id).toBe("sec-A");
    expect(beta?.id).toBe("sec-B");
    expect(fresh).toBeNull();
  });

  it("the id wins even over identical question text elsewhere", () => {
    const existing = twoSections(true);
    const [first, second] = claimSectionsForEntries(existing, new Set(existing.map((e) => e.id)), [
      entry("Solve 2x + 5 = 17", "3:example:0", { docSectionId: "q-alpha" }),
      entry("Solve 2x + 5 = 17", "3:example:1", { docSectionId: "q-beta" }),
    ]);
    expect(first?.id).toBe("sec-A");
    expect(second?.id).toBe("sec-B");
  });

  it("two questions sharing one id (a copy-paste): the first keeps the row, the copy never steals another", () => {
    const existing = twoSections(true);
    const [original, copy] = claimSectionsForEntries(existing, new Set(existing.map((e) => e.id)), [
      entry("Solve 2x + 5 = 17", "3:example:0", { docSectionId: "q-alpha" }),
      entry("A pasted copy, edited", "3:example:1", { docSectionId: "q-alpha" }),
    ]);
    expect(original?.id).toBe("sec-A");
    expect(copy?.id).not.toBe("sec-A");
  });

  it("rows saved before this change (no id) still match by text and key", () => {
    const existing = twoSections(false);
    const [first, second] = claimSectionsForEntries(existing, new Set(existing.map((e) => e.id)), [
      entry("Solve 2x + 5 = 17", "3:example:0", { docSectionId: "q-alpha" }),
      entry("Factorise x^2 - 5x + 6", "3:example:1", { docSectionId: "q-beta" }),
    ]);
    expect(first?.id).toBe("sec-A");
    expect(second?.id).toBe("sec-B");
  });
});

describe("matchSubsectionsForSection — reordering must not orphan a question's row", () => {
  const rows = () => ({
    subs: [
      sub("row-A", "Solve 2x + 5 = 17", "3:example:0"),
      sub("row-B", "Factorise x^2 - 5x + 6", "3:example:1"),
    ],
  });
  const wrap = (s: { subs: MatchableSub[] }) => [{ kind: "example", subs: s.subs }];

  it("reclaims a row by its unchanged text when reordering changed its doc_key", () => {
    const s = rows();
    const { claimed, leftoverPool } = matchSubsectionsForSection(s, wrap(s), new Set(), "example", [
      { problem: "Factorise x^2 - 5x + 6", docKey: "3:example:0" },
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:1" },
    ]);
    expect(claimed[0]?.id).toBe("row-B");
    expect(claimed[1]?.id).toBe("row-A");
    expect(leftoverPool).toHaveLength(0);
  });

  it("still matches by doc_key when nothing moved", () => {
    const s = rows();
    const { claimed, leftoverPool } = matchSubsectionsForSection(s, wrap(s), new Set(), "example", [
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:0" },
      { problem: "Factorise x^2 - 5x + 6", docKey: "3:example:1" },
    ]);
    expect(claimed[0]?.id).toBe("row-A");
    expect(claimed[1]?.id).toBe("row-B");
    expect(leftoverPool).toHaveLength(0);
  });

  it("still deletes a question the teacher actually removed", () => {
    const s = rows();
    const { claimed, leftoverPool } = matchSubsectionsForSection(s, wrap(s), new Set(), "example", [
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:0" },
    ]);
    expect(claimed[0]?.id).toBe("row-A");
    expect(leftoverPool.map((p) => p.id)).toEqual(["row-B"]);
  });

  it("does not let a stale positional key steal another question's saved row", () => {
    const s = rows();
    const { claimed, leftoverPool } = matchSubsectionsForSection(s, wrap(s), new Set(), "example", [
      { problem: "A brand new inserted question", docKey: "3:example:0" },
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:1" },
      { problem: "Factorise x^2 - 5x + 6", docKey: "3:example:2" },
    ]);
    expect(claimed[0]).toBeNull();
    expect(claimed[1]?.id).toBe("row-A");
    expect(claimed[2]?.id).toBe("row-B");
    expect(leftoverPool).toHaveLength(0);
  });

  it("subsection rows are claimed by permanent id before text", () => {
    const s = {
      subs: [sub("row-A", "Solve 2x + 5 = 17", "3:example:0", { doc_section_id: "q-alpha" })],
    };
    const { claimed } = matchSubsectionsForSection(s, wrap(s), new Set(), "example", [
      { problem: "Solve 2x + 5 = 19, completely reworded", docKey: "9:example:4", docSectionId: "q-alpha" },
    ]);
    expect(claimed[0]?.id).toBe("row-A");
  });

  it("a question moved to another session still finds its row by text", () => {
    const a = { kind: "example", subs: [sub("row-A", "Solve 2x + 5 = 17", "3:example:0")] };
    const b = { kind: "example", subs: [] as MatchableSub[] };
    const { claimed } = matchSubsectionsForSection(b, [a, b], new Set(), "example", [
      { problem: "Solve 2x + 5 = 17", docKey: "5:example:0" },
    ]);
    expect(claimed[0]?.id).toBe("row-A");
  });
});
