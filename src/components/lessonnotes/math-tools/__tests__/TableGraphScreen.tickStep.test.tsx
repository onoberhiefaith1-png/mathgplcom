import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";
import { TableGraphScreen } from "../TableGraphScreen";

vi.mock("@/lib/graph/digitalView", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/graph/digitalView")>();
  const view = { cx: 0, cy: 0, scaleX: 20, scaleY: 20 };
  return { ...actual, fitPoints: () => view };
});
vi.mock("@/lib/graph/graphTheme", () => ({
  graphInk: () => ({
    bg: "#fff", majorGrid: "#ccc", minorGrid: "#eee", axis: "#111", text: "#111", ink: "#111",
  }),
}));

const W = 800, H = 600;
const STEP = { x: 2, y: 5 };

describe("TableGraphScreen zoom keeps the tick step fixed", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const render = async () => {
    dom = setupDom();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => W });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => H });
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
    await dom.render(
      <TableGraphScreen
        headers={["x", "y"]}
        cells={[["-2", "5"], ["0", "10"], ["2", "15"], ["4", "20"]]}
        xCol={0}
        yCol={1}
        tickStep={STEP}
        graphScore={{ enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }}
        teacherAxes={{ xCol: 0, yCol: 1 }}
        onClose={() => {}}
      />,
    );
    const svg = document.querySelector("[data-table-graph-canvas]") as SVGSVGElement;
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: W, bottom: H, width: W, height: H, toJSON() { return {}; },
    });
    return svg;
  };

  const tickValues = (axis: "x" | "y") =>
    [...document.querySelectorAll(`[data-major-tick="${axis}"]`)].map((el) => Number(el.getAttribute("data-tick-value")));
  const majorGrids = (axis: "x" | "y") => document.querySelectorAll(`[data-major-grid="${axis}"]`).length;

  const onStep = (values: number[], step: number) => {
    for (const v of values) expect(v / step).toBeCloseTo(Math.round(v / step), 8);
  };

  it("records the teacher scale on the canvas and labels X by 2 and Y by 5", async () => {
    await render();
    const svg = document.querySelector("[data-table-graph-canvas]") as SVGSVGElement;
    expect(svg.getAttribute("data-tick-step-x")).toBe("2");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    onStep(tickValues("x"), 2);
    onStep(tickValues("y"), 5);
  });

  it("keeps the same tick step after zoom out and zoom in, and zoom is uniform", async () => {
    const svg = await render();
    const beforeX = majorGrids("x");
    const beforeY = majorGrids("y");
    const zoomOut = document.querySelector('[aria-label="Zoom out"]') as HTMLButtonElement;
    const zoomIn = document.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement;

    await act(async () => { zoomOut.click(); zoomOut.click(); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("2");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    onStep(tickValues("x"), 2);
    onStep(tickValues("y"), 5);
    expect(majorGrids("x")).toBeGreaterThan(beforeX);
    expect(majorGrids("y")).toBeGreaterThan(beforeY);
    const outCountX = majorGrids("x");

    await act(async () => { zoomIn.click(); zoomIn.click(); zoomIn.click(); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("2");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    onStep(tickValues("x"), 2);
    onStep(tickValues("y"), 5);
    expect(majorGrids("x")).toBeLessThan(outCountX);
  });
});
