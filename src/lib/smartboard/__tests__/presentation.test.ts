import { describe, expect, it } from "vitest";
import { buildLessonBoardSource, buildReservoirs } from "@/lib/smartboard/presentation";
import type { SectionRow, BlockRow } from "@/hooks/useNotebook";

const block = (kind: BlockRow["kind"], text: string): BlockRow => ({
  id: `${kind}-1`,
  section_id: "sec-1",
  subsection_id: "sub-1",
  kind,
  content_ascii: text,
  order_index: kind === "problem" ? 0 : kind === "solution" ? 1 : 2,
});

const exampleSection = (solution: string, overrides?: { floating_lines?: any[]; floating_bucket?: any; floating_highlights?: any[] }): SectionRow => ({
  id: "sec-1",
  notebook_id: "nb-1",
  kind: "example",
  title: null,
  order_index: 0,
  subsections: [
    {
      id: "sub-1",
      section_id: "sec-1",
      order_index: 0,
      blocks: [block("problem", "2+2+2"), block("solution", solution)],
      floating_lines: overrides?.floating_lines ?? null,
      floating_bucket: overrides?.floating_bucket ?? null,
      floating_highlights: overrides?.floating_highlights ?? null,
    },
  ],
  loose: [],
});

describe("buildReservoirs canonical floating source", () => {
  it("never derives floating chips from solution equations", () => {
    const reservoirs = buildReservoirs([exampleSection("2+2+2\n= 6")]);
    expect(reservoirs).toHaveLength(1);
    const [r] = reservoirs;
    expect(r.lines).toEqual([]);
    expect(r.fragments).toEqual([]);
  });

  it("keeps the reservoir empty for prose-only solutions without floating data", () => {
    const reservoirs = buildReservoirs([exampleSection("Think about adding the three numbers.")]);
    expect(reservoirs).toHaveLength(1);
    const [r] = reservoirs;
    expect(r.fragments).toEqual([]);
    expect(r.lines).toEqual([]);
  });


  it("does not override teacher-curated floating lines", () => {
    const curated = {
      floating_lines: [{ equation: "2+2+2", fillers: ["2", "2", "2"], containers: [] }],
    };
    const reservoirs = buildReservoirs([exampleSection("2+2+2\n= 6", curated)]);
    expect(reservoirs).toHaveLength(1);
    const [r] = reservoirs;
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].equation).toBe("2+2+2");
    expect(r.fragments).toEqual(["2", "2", "2"]);
  });

  it("preserves saved line identity, structure, and arranged chip order", () => {
    const curated = {
      floating_lines: [{
        lineId: "line-power-root",
        sourceUid: "highlight-power-root",
        equation: "A^M+sqrt(x)",
        fillers: ["A^M", "√x", "+"],
        containers: ["power", "radical"],
        arrangement: [1, 2, 0],
      }],
    };
    const [reservoir] = buildReservoirs([exampleSection("A^M+sqrt(x)", curated)]);
    expect(reservoir.fragments).toEqual(["√x", "+", "A^M"]);
    expect(reservoir.lines[0]).toMatchObject({
      lineId: "line-power-root",
      sourceUid: "highlight-power-root",
      containers: ["power", "radical"],
      fragmentStart: 0,
      fragmentEnd: 3,
    });
  });

  it("uses the same canonical source boundary for every lesson gateway", () => {
    const sections = [exampleSection("A^M", {
      floating_lines: [{
        lineId: "line-1",
        sourceUid: "source-1",
        equation: "A^M",
        fillers: ["A", "^M"],
        containers: ["power"],
        arrangement: [1, 0],
      }],
    })];
    const source = buildLessonBoardSource(sections);
    expect(source.reservoirs).toEqual(buildReservoirs(sections));
    expect(source.reservoirs[0].lines[0].lineId).toBe("line-1");
    expect(source.reservoirs[0].fragments).toEqual(["^M", "A"]);
  });

  it("does not override teacher-curated floating bucket", () => {
    const curated = {
      floating_bucket: {
        fillers: ["3", "3"],
        viewCombined: ["3", "3"],
        byLine: [{ lineId: "legacy-line", fillerStart: 0, fillerEnd: 2 }],
      },
    };
    const reservoirs = buildReservoirs([exampleSection("2+2+2\n= 6", curated)]);
    expect(reservoirs).toHaveLength(1);
    const [r] = reservoirs;
    expect(r.fragments).toEqual(["3", "3"]);
    expect(r.lines.map((line) => line.lineId)).toEqual(["legacy-line"]);
  });

  it("does not flatten a legacy bucket without recoverable line boundaries", () => {
    const curated = {
      floating_bucket: { fillers: ["3", "3"], viewCombined: ["3", "3"] },
    };
    const [reservoir] = buildReservoirs([exampleSection("3+3=6", curated)]);
    expect(reservoir.fragments).toEqual([]);
    expect(reservoir.lines).toEqual([]);
  });
});
