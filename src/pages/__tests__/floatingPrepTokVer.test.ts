import { describe, expect, it } from "vitest";
import {
  highlightTokVersion,
  recomputeNotebooks,
  restorePersistedHighlights,
} from "../FloatingPreparationPage";

type H = Parameters<typeof recomputeNotebooks>[0];
type P = NonNullable<Parameters<typeof restorePersistedHighlights>[0]>;
const tok = (line: number, tok: number) => ({ line, tok });

describe("Floating Preparation — tokenizer version follows the saved highlights", () => {
  it("no text highlights -> v2 (new work gets the fraction-aware tokenizer)", () => {
    expect(highlightTokVersion([])).toBe(2);
    expect(
      highlightTokVersion([
        {
          groupId: 1,
          tokens: [],
          payload: "[table]",
          object: {} as unknown as NonNullable<H[number]["object"]>,
        },
      ]),
    ).toBe(2);
  });

  it("a highlight saved before v2 (no tokVer) keeps the original tokenizer", () => {
    expect(
      highlightTokVersion([{ groupId: 1, tokens: [tok(0, 0)], payload: "x" }]),
    ).toBe(1);
  });

  it("all tokVer 2 -> v2; any legacy highlight pulls the set back to v1", () => {
    const v2 = {
      groupId: 1,
      tokens: [tok(0, 0)],
      payload: "x",
      tokVer: 2 as const,
    };
    expect(highlightTokVersion([v2])).toBe(2);
    expect(
      highlightTokVersion([
        v2,
        { groupId: 2, tokens: [tok(0, 1)], payload: "y" },
      ]),
    ).toBe(1);
  });

  it("restorePersistedHighlights keeps tokVer, and does not invent one for legacy rows", () => {
    const { highlights } = restorePersistedHighlights([
      { groupId: 1, payload: "a", tokens: [tok(0, 0)], tokVer: 2 },
      { groupId: 2, payload: "b", tokens: [tok(0, 1)] },
    ]);
    expect(highlights[0].tokVer).toBe(2);
    expect(highlights[1].tokVer).toBeUndefined();
  });

  it("legacy highlights still map onto the original token indices (nothing shifts)", () => {
    // `Find \frac {3}{4} + 1` was ["Find","\\frac","{3}{4}","+","1"] in the original tokenizer,
    // so a highlight saved on tok 3..4 is "+ 1" and everything before it is the lead-in.
    const lines = ["Find \\frac {3}{4} + 1"];
    const legacy = [
      { groupId: 1, tokens: [tok(0, 3), tok(0, 4)], payload: "+ 1", uid: "u1" },
    ];
    const out = recomputeNotebooks(legacy as H, lines);
    expect(out.find((h) => h.notebookOnly)?.precedingNotebook).toBe(
      "Find \\frac {3}{4}",
    );
    expect(out.find((h) => h.uid === "u1")?.tokVer).toBeUndefined();
  });

  it("v2 highlights index the fraction as one token", () => {
    const lines = ["Find \\frac {3}{4} + 1"];
    // v2 tokens: Find | \frac {3}{4} | + | 1  -> highlight tok 1..3
    const v2 = [
      {
        groupId: 1,
        tokens: [tok(0, 1), tok(0, 2), tok(0, 3)],
        payload: "\\frac {3}{4} + 1",
        uid: "u2",
        tokVer: 2 as const,
      },
    ];
    const out = recomputeNotebooks(v2 as H, lines);
    const lead = out.find((h) => h.notebookOnly);
    expect(lead?.precedingNotebook).toBe("Find");
    expect(out.find((h) => h.uid === "u2")?.tokVer).toBe(2);
  });
});
