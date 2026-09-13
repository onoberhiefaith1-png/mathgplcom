// TABLE LAW — a hand-typed table produced by the AI must become the platform's
// real Smart Table, never flattened text.
import { describe, expect, it } from "vitest";
import {
  convertHandTables,
  detectHandTables,
  tableViolations,
  TABLE_RECOGNITION_STANDARD,
} from "../../../../supabase/functions/notebook-ai/tableStandard";
import { aiTextToNodes } from "../aiToNodes";

const firstTable = (text: string) => {
  const nodes = aiTextToNodes(text);
  const found: any[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (n.type === "mathVisual" && n.attrs?.family === "smarttable") found.push(n.attrs.attrs);
    (n.content ?? []).forEach(walk);
  };
  (Array.isArray(nodes) ? nodes : [nodes]).forEach(walk);
  return found[0];
};

describe("hand-typed table detection", () => {
  it("reads a markdown/pipe frequency table", () => {
    const raw = [
      "The table below shows the goals scored.",
      "| x | f | fx |",
      "| --- | --- | --- |",
      "| 0 | 3 | 0 |",
      "| 1 | 5 | 5 |",
    ].join("\n");
    const [t] = detectHandTables(raw);
    expect(t.headers).toEqual(["x", "f", "fx"]);
    expect(t.rows).toEqual([["0", "3", "0"], ["1", "5", "5"]]);
  });

  it("reads an array environment", () => {
    const raw = "\\begin{array}{|c|c|}\\hline x & y \\\\ \\hline 1 & 2 \\\\ 3 & 4 \\\\ \\hline\\end{array}";
    const [t] = detectHandTables(raw);
    expect(t.headers).toEqual(["x", "y"]);
    expect(t.rows.length).toBe(2);
  });

  it("ignores prose and single-column lines", () => {
    expect(detectHandTables("The mean is 2.4 marks.\nx = 3\n")).toHaveLength(0);
    expect(convertHandTables("The mean is 2.4 marks.")).toBe("The mean is 2.4 marks.");
  });
});

describe("conversion into the existing Smart Table directive", () => {
  it("rewrites pipe rows into one directive", () => {
    const out = convertHandTables("| x | f |\n| 1 | 2 |\n| 3 | 4 |");
    expect(out).toContain('[[tool:smartTable headers="x | f" rows="1 | 2 ; 3 | 4"]]');
    expect(out).not.toMatch(/^\s*\|/m);
  });

  it("rewrites an array environment into one directive", () => {
    const out = convertHandTables(
      "\\begin{array}{|c|c|c|}\\hline x & f & fx \\\\ \\hline 0 & 3 & 0 \\\\ 1 & 5 & 5 \\\\ \\hline\\end{array}",
    );
    expect(out).toContain("[[tool:smartTable");
    expect(out).not.toContain("\\begin{array}");
  });

  it("rewrites an ASCII-ruled grid", () => {
    const out = convertHandTables(
      ["+-----+-----+", "| x   | y   |", "+-----+-----+", "| 1   | 2   |", "+-----+-----+"].join("\n"),
    );
    expect(out).toContain("[[tool:smartTable");
  });

  it("leaves ragged / one-column pipe content alone", () => {
    const src = "a | b\n";
    expect(convertHandTables(src)).toBe(src);
  });

  it("materialises the same editable node a teacher's own table produces", () => {
    const attrs = firstTable(convertHandTables("| x | f | fx |\n| 0 | 3 | 0 |\n| 1 | 5 | 5 |"));
    expect(attrs).toBeTruthy();
    expect(attrs.cols).toBe(3);
    expect(attrs.rows).toBe(2);
    expect(attrs.headers).toEqual(["x", "f", "fx"]);
    expect(attrs.cells[1]).toEqual(["1", "5", "5"]);
  });

  it("keeps a blank cell in its own column", () => {
    const attrs = firstTable('[[tool:smartTable headers="x | f | fx" rows="0 | 3 |  ; 1 | 5 | 5"]]');
    expect(attrs.cells[0]).toEqual(["0", "3", ""]);
  });
});

describe("table violations are binding", () => {
  it("flags a surviving hand-made table", () => {
    expect(tableViolations("| x | f |\n| 1 | 2 |").length).toBeGreaterThan(0);
  });

  it("flags space-aligned numeric columns", () => {
    const raw = "x    f    fx\n0    3    0\n1    5    5\n2    4    8";
    expect(tableViolations(raw).length).toBeGreaterThan(0);
  });

  it("passes content that already uses the directive", () => {
    expect(tableViolations('[[tool:smartTable headers="x | f" rows="1 | 2"]]')).toHaveLength(0);
  });

  it("passes ordinary prose and a matrix", () => {
    expect(tableViolations("The frequency table below shows the goals scored.")).toHaveLength(0);
    expect(tableViolations("\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}")).toHaveLength(0);
  });
});

describe("recognition standard covers the curriculum", () => {
  const topics = [
    "frequency", "cumulative", "table of values", "Sequences", "Logarithms",
    "antilogarithm", "sine", "outcome", "sample-space", "coordinate",
    "mensuration", "conversion", "interest", "depreciation", "factors", "HCF", "LCM",
  ];
  it.each(topics)("names %s", (t) => {
    expect(TABLE_RECOGNITION_STANDARD.toLowerCase()).toContain(t.toLowerCase());
  });

  it("states that the trigger is structure, not the word table", () => {
    expect(TABLE_RECOGNITION_STANDARD).toContain("NOT THE WORD");
    expect(TABLE_RECOGNITION_STANDARD).toContain("[[tool:smartTable");
  });
});
