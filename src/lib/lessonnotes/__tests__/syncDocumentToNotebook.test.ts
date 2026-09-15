import { describe, it, expect } from "vitest";
import {
  matchSubsectionsForSection,
  claimSectionForEntry,
} from "@/lib/lessonnotes/syncDocumentToNotebook";

// A section with two saved questions. Both already carry a doc_key from a
// prior save (the normal state of any previously-saved notebook), and both
// hold real Floating Numbers state — represented here just by `problem`,
// since matching never looks at floating_lines itself.
const existingSection = () => ({
  subs: [
    {
      id: "row-A",
      section_id: "sec-1",
      order_index: 0,
      problem: "Solve 2x + 5 = 17",
      doc_key: "3:example:0",
    },
    {
      id: "row-B",
      section_id: "sec-1",
      order_index: 1,
      problem: "Factorise x^2 - 5x + 6",
      doc_key: "3:example:1",
    },
  ],
});

describe("matchSubsectionsForSection — reordering must not orphan a question's row", () => {
  it("reclaims a row by its unchanged problem text when reordering changed its doc_key", () => {
    const section = existingSection();
    const existing = [
      {
        id: "sec-1",
        kind: "example",
        order_index: 0,
        doc_key: "3:example",
        subs: section.subs,
      },
    ];
    const claimedSubIds = new Set<string>();

    // The two questions swapped places: row-B's question is now first, so its
    // NEW doc_key ("3:example:0") collides with row-A's OLD doc_key, and every
    // doc_key below the swap point has shifted. Problem text is unchanged.
    const parsedSubsections = [
      { problem: "Factorise x^2 - 5x + 6", docKey: "3:example:0" },
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:1" },
    ];

    const { claimed, leftoverPool } = matchSubsectionsForSection(
      section,
      existing,
      claimedSubIds,
      "example",
      parsedSubsections,
    );

    // Regression: before the fix, neither row's stale doc_key matched the new
    // key, and the text-fallback excluded any row that already had a doc_key
    // at all — so both rows fell through to "unclaimed" and were deleted,
    // taking their saved Floating Numbers with them.
    expect(claimed[0]?.id).toBe("row-B");
    expect(claimed[1]?.id).toBe("row-A");
    expect(leftoverPool).toHaveLength(0);
  });

  it("still matches by doc_key first when nothing moved", () => {
    const section = existingSection();
    const existing = [
      {
        id: "sec-1",
        kind: "example",
        order_index: 0,
        doc_key: "3:example",
        subs: section.subs,
      },
    ];
    const claimedSubIds = new Set<string>();

    const parsedSubsections = [
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:0" },
      { problem: "Factorise x^2 - 5x + 6", docKey: "3:example:1" },
    ];

    const { claimed, leftoverPool } = matchSubsectionsForSection(
      section,
      existing,
      claimedSubIds,
      "example",
      parsedSubsections,
    );

    expect(claimed[0]?.id).toBe("row-A");
    expect(claimed[1]?.id).toBe("row-B");
    expect(leftoverPool).toHaveLength(0);
  });

  it("still deletes a question the teacher actually removed", () => {
    const section = existingSection();
    const existing = [
      {
        id: "sec-1",
        kind: "example",
        order_index: 0,
        doc_key: "3:example",
        subs: section.subs,
      },
    ];
    const claimedSubIds = new Set<string>();

    // The first question is kept, unchanged; the second was genuinely
    // deleted, not replaced — nothing in the new document text-or-key
    // matches row-B, so it alone is left orphaned for deletion.
    const parsedSubsections = [
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:0" },
    ];

    const { claimed, leftoverPool } = matchSubsectionsForSection(
      section,
      existing,
      claimedSubIds,
      "example",
      parsedSubsections,
    );

    expect(claimed[0]?.id).toBe("row-A");
    expect(leftoverPool.map((p) => p.id)).toEqual(["row-B"]);
  });

  it("does not let a stale positional key steal another question's saved row", () => {
    const section = existingSection();
    const existing = [
      {
        id: "sec-1",
        kind: "example",
        order_index: 0,
        doc_key: "3:example",
        subs: section.subs,
      },
    ];
    const claimedSubIds = new Set<string>();

    // A brand-new question is inserted ABOVE the two existing ones. Every
    // existing question's ordinal — and so its doc_key — shifts down by one,
    // but neither existing question's own text changed.
    const parsedSubsections = [
      { problem: "A brand new inserted question", docKey: "3:example:0" },
      { problem: "Solve 2x + 5 = 17", docKey: "3:example:1" },
      { problem: "Factorise x^2 - 5x + 6", docKey: "3:example:2" },
    ];

    const { claimed, leftoverPool } = matchSubsectionsForSection(
      section,
      existing,
      claimedSubIds,
      "example",
      parsedSubsections,
    );

    // Regression: with doc_key matched before problem text, row-A's stale
    // key "3:example:0" would match the new inserted question (wrong
    // question, wrong Floating Numbers), while the real "Solve 2x+5=17"
    // question — now at position 1 — would find nothing and get a blank new
    // row, losing its own saved Floating Numbers.
    expect(claimed[0]).toBeNull();
    expect(claimed[1]?.id).toBe("row-A");
    expect(claimed[2]?.id).toBe("row-B");
    expect(leftoverPool).toHaveLength(0);
  });
});

// Each question is its OWN top-level section+subsection pair (one question
// per "example"/"exercise"/etc. heading) — so THIS is where a real reordered
// or newly-inserted question's row is actually found or lost in production,
// not matchSubsectionsForSection (whose pool is always length 1 in practice).
describe("claimSectionForEntry — same identity risk, one level up", () => {
  const existingSections = () => [
    {
      id: "sec-A",
      kind: "example",
      order_index: 0,
      doc_key: "3:example:0",
      subs: [
        {
          id: "row-A",
          section_id: "sec-A",
          order_index: 0,
          problem: "Solve 2x + 5 = 17",
          doc_key: "3:example:0",
        },
      ],
    },
    {
      id: "sec-B",
      kind: "example",
      order_index: 1,
      doc_key: "3:example:1",
      subs: [
        {
          id: "row-B",
          section_id: "sec-B",
          order_index: 0,
          problem: "Factorise x^2 - 5x + 6",
          doc_key: "3:example:1",
        },
      ],
    },
  ];

  it("swap: reclaims each section by its own unchanged question text", () => {
    const existing = existingSections();
    const unclaimed = new Set(existing.map((e) => e.id));

    // Two questions swapped places — same collision shape as the subsection
    // test above, one level up (whole sections, not subsections within one).
    const first = claimSectionForEntry(
      existing,
      unclaimed,
      "example",
      "3:example:0",
      "Factorise x^2 - 5x + 6",
    );
    const second = claimSectionForEntry(
      existing,
      unclaimed,
      "example",
      "3:example:1",
      "Solve 2x + 5 = 17",
    );

    expect(first?.id).toBe("sec-B");
    expect(second?.id).toBe("sec-A");
  });

  it("pure reorder alone (no insertion): each section still finds its own row", () => {
    const existing = existingSections();
    const unclaimed = new Set(existing.map((e) => e.id));

    const first = claimSectionForEntry(
      existing,
      unclaimed,
      "example",
      "3:example:0",
      "Solve 2x + 5 = 17",
    );
    const second = claimSectionForEntry(
      existing,
      unclaimed,
      "example",
      "3:example:1",
      "Factorise x^2 - 5x + 6",
    );

    expect(first?.id).toBe("sec-A");
    expect(second?.id).toBe("sec-B");
  });

  it("KNOWN REMAINING GAP: inserting a new question above still lets a later entry steal an earlier one's stale key", () => {
    // claimSectionForEntry is called once per parsed section, in document
    // order, from syncDocumentToNotebook's single top-to-bottom loop — unlike
    // matchSubsectionsForSection, it is NOT (yet) run as an all-text-matches-
    // first pass across every section before any key fallback runs. So the
    // FIRST entry processed (the brand-new question, now at position 0) can
    // still claim row-A's stale "3:example:0" key before row-A's own entry
    // (processed second, now at position 1) gets a chance to claim it by text.
    // Closing this fully requires the same two-pass restructuring applied to
    // syncDocumentToNotebook's main loop — a bigger change to a very central,
    // sensitive function, intentionally left for a separate, explicit pass.
    const existing = existingSections();
    const unclaimed = new Set(existing.map((e) => e.id));

    const inserted = claimSectionForEntry(
      existing,
      unclaimed,
      "example",
      "3:example:0",
      "A brand new inserted question",
    );
    expect(inserted?.id).toBe("sec-A"); // wrong: should be null (no match), not sec-A
  });
});
