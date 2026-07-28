// Regression: a `box` node is a transparent writing cell. If the ASCII
// flattener skips it, whole numerators disappear (x=()/2a) and the Reasoning
// panel / grader disagree with the Smartboard.

import { describe, it, expect } from "vitest";
import { rowToAscii } from "@/lib/smartboard/rowAscii";

const chars = (s: string) => s.split("").map((ch) => ({ ch }));

describe("rowToAscii — box nodes", () => {
  it("flattens a box verbatim", () => {
    expect(rowToAscii([{ kind: "box", rows: [chars("-b")] } as any])).toBe("-b");
  });

  it("keeps a box-wrapped numerator inside a fraction", () => {
    const row: any[] = [
      { ch: "x" },
      { ch: "=" },
      {
        kind: "frac",
        rows: [[{ kind: "box", rows: [[{ kind: "box", rows: [chars("-b")] }]] }], chars("2a")],
      },
    ];
    const out = rowToAscii(row as any);
    expect(out).toContain("-b");
    expect(out).not.toContain("()");
  });

  it("leaves an empty box empty", () => {
    expect(rowToAscii([{ kind: "box", rows: [[]] } as any])).toBe("");
  });
});
