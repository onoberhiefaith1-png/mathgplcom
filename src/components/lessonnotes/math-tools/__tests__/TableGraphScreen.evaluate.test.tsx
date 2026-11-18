import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";
import { TableGraphScreen } from "../TableGraphScreen";

vi.mock("@/lib/graph/digitalView", () => {
  const view = { cx: 0, cy: 0, scaleX: 20, scaleY: 20 };
  return {
    fitPoints: () => view,
    gridLines: () => ({ vertical: [], horizontal: [] }),
    panView: (v: typeof view) => v,
    toData: () => ({ x: 0, y: 0 }),
    toPx: () => ({ x: 40, y: 40 }),
    zoomAt: (v: typeof view) => v,
    zoomFactorFromWheel: () => 1,
    placeWorldPoint: (x: number, y: number) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }),
    zoomStripRects: () => ({
      vertical: { x: 0, y: 0, width: 0, height: 0 },
      horizontal: { x: 0, y: 0, width: 0, height: 0 },
    }),
    zoomZone: () => ({ axis: "both", highlight: "none" }),
  };
});
vi.mock("@/lib/graph/graphTheme", () => ({
  graphInk: () => ({
    bg: "#fff", majorGrid: "#ccc", minorGrid: "#eee", axis: "#111", text: "#111", ink: "#111",
  }),
}));

const base = {
  headers: ["x", "y"],
  cells: [["0", "1"], ["1", "3"], ["2", "5"]],
  xCol: 0,
  yCol: 1,
  graphScore: { enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 },
  teacherAxes: { xCol: 0, yCol: 1 },
  initialPoints: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 4, y: 9 }],
  initialConnect: "line" as const,
  onClose: () => {},
};

describe("TableGraphScreen Evaluate and live score", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const render = async (extra: Record<string, unknown> = {}) => {
    dom = setupDom();
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    await dom.render(<TableGraphScreen {...base} {...extra} />);
  };

  it("never puts Evaluate in the DOM for a student, and keeps the live mark counter", async () => {
    await render({ isTeacher: false });
    expect(document.querySelector("[data-evaluate-graph]")).toBeNull();
    expect(document.querySelector("[data-evaluate-panel]")).toBeNull();
    const counter = document.querySelector("[data-graph-score]");
    expect(counter).not.toBeNull();
    expect(counter!.textContent).toMatch(/4\s*\/\s*14/);
  });

  it("shows a teacher-only Evaluate button that reveals the breakdown and highlights", async () => {
    await render({ isTeacher: true });
    const btn = document.querySelector("[data-evaluate-graph]") as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toMatch(/Evaluate/i);
    expect(document.querySelector("[data-evaluate-panel]")).toBeNull();

    await act(async () => btn!.click());
    const panel = document.querySelector("[data-evaluate-panel]");
    expect(panel).not.toBeNull();
    expect(document.querySelector("[data-evaluate-score]")!.textContent).toMatch(/4\s*\/\s*14/);
    expect(document.querySelector("[data-evaluate-correct]")!.textContent).toMatch(/2/);
    expect(document.querySelector("[data-evaluate-incorrect]")!.textContent).toMatch(/1/);
    const dots = [...document.querySelectorAll("[data-plotted-point]")] as SVGCircleElement[];
    expect(dots.some((d) => d.getAttribute("data-point-correct") === "true" && d.getAttribute("fill") === "#15803D")).toBe(true);
    expect(dots.some((d) => d.getAttribute("data-point-correct") === "false" && d.getAttribute("fill") === "#B91C1C")).toBe(true);
  });

  it("hides the live score and awards no marks when the graph is not activated", async () => {
    await render({ isTeacher: true, teacherAxes: undefined, graphScore: { enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 } });
    expect(document.querySelector("[data-graph-score]")).toBeNull();
    await act(async () => (document.querySelector("[data-evaluate-graph]") as HTMLButtonElement).click());
    expect(document.querySelector("[data-evaluate-inactive]")).not.toBeNull();
  });
});
