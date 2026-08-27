import { describe, expect, it } from "vitest";
import { buildReservoirs } from "@/lib/smartboard/presentation";
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

describe("buildReservoirs floating fallback", () => {
  it("derives floating chips from solution equations when no teacher-curated data exists", () => {
    const reservoirs = buildReservoirs([exampleSection("2+2+2\n= 6")]);
    expect(reservoirs).toHaveLength(1);
    const [r] = reservoirs;
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.fragments.length).toBeGreaterThan(0);
    // Each solution equation becomes one reservoir line.
    expect(r.lines.map((l) => l.equation)).toEqual(["2+2+2", "= 6"]);
    // The fragments should be the decomposed terms.
    expect(r.fragments.some((f) => f.includes("2"))).toBe(true);
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

  it("does not override teacher-curated floating bucket", () => {
    const curated = {
      floating_bucket: { fillers: ["3", "3"], viewCombined: ["3", "3"] },
    };
    const reservoirs = buildReservoirs([exampleSection("2+2+2\n= 6", curated)]);
    expect(reservoirs).toHaveLength(1);
    const [r] = reservoirs;
    expect(r.fragments).toEqual(["3", "3"]);
  });
});
