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

const geometryObject = (id: string, activity = false) => ({
  objId: id,
  nodeType: "geometryDiagram",
  family: "diagram",
  label: "Diagram",
  afterLine: 1,
  floatable: false,
  presentOnBoard: false,
  attrs: {
    ...(activity ? { diagramActivity: true } : {}),
    scene: { bounds: { width: 300, height: 200 }, objects: [] },
  },
});

describe("diagram presentation", () => {
  it("keeps a highlighted diagram between its surrounding rows and emits no chips for it", () => {
    const activity = geometryObject("selected", true);
    const [reservoir] = buildReservoirs([exampleSection("x=2\n x=3", {
      floating_highlights: [
        { uid: "first", groupId: 1, payload: "x=2" },
        { uid: "geometry", groupId: 2, payload: "[Diagram]", object: activity },
        { uid: "last", groupId: 3, payload: "x=3" },
      ],
    })]);
    expect(reservoir.lines.map((line) => line.equation)).toEqual(["x=2", "", "x=3"]);
    expect(reservoir.lines[1]).toMatchObject({
      notebookOnly: true,
      fillers: [],
      noteObjects: [activity],
    });
  });

  it("renders an unselected diagram with the notes without generating chips", () => {
    const section = exampleSection("Look at this corner.");
    const solution = section.subsections[0].blocks[1];
    solution.content_json = { objects: [geometryObject("notes")] } as BlockRow["content_json"];
    const [reservoir] = buildReservoirs([section]);
    expect(reservoir.fragments).toEqual([]);
    expect(reservoir.lines.flatMap((line) => line.noteObjects ?? [])).toMatchObject([
      { objId: "notes", attrs: { scene: { objects: [] } } },
    ]);
  });
});
