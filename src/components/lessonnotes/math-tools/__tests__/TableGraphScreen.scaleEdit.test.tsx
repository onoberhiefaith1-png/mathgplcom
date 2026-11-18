import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";
import { placeWorldPoint } from "@/lib/graph/digitalView";
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
const VIEW = { cx: 0, cy: 0, scaleX: 20, scaleY: 20 };
// Origin at (400, 300). X-strip is 100px around y=0; Y-strip is 40px around x=0
// when the scale is X 2 / Y 5.
const X_ZONE = { x: 600, y: 300 };
const Y_ZONE = { x: 400, y: 100 };
const PLOT = { x: 600, y: 100 };

describe("TableGraphScreen per-axis scale editing", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const onPointsChange = vi.fn();

  const render = async () => {
    onPointsChange.mockReset();
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
        tickStep={{ x: 2, y: 5 }}
        graphScore={{ enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }}
        teacherAxes={{ xCol: 0, yCol: 1 }}
        onPointsChange={onPointsChange}
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

  const onStep = (values: number[], step: number) => {
    for (const v of values) expect(v / step).toBeCloseTo(Math.round(v / step), 8);
  };

  const wheel = (svg: Element, x: number, y: number, deltaY: number) => {
    const ev = new Event("wheel", { bubbles: true, cancelable: true });
    Object.assign(ev, { clientX: x, clientY: y, deltaY, deltaMode: 0 });
    svg.dispatchEvent(ev);
  };

  const pointer = (svg: Element, type: string, x: number, y: number, pointerId = 1) => {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, {
      clientX: x, clientY: y, pointerId, pointerType: "touch",
      isPrimary: pointerId === 1, button: 0, buttons: type === "pointerup" ? 0 : 1,
    });
    svg.dispatchEvent(ev);
  };

  it("changes only the X tick step from a wheel in the X-axis zone, and shows the strip", async () => {
    const svg = await render();
    await act(async () => { wheel(svg, X_ZONE.x, X_ZONE.y, 100); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("5");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    expect(svg.getAttribute("data-scale-zone")).toBe("x");
    onStep(tickValues("x"), 5);
    onStep(tickValues("y"), 5);
    const strip = document.querySelector("[data-zoom-strip]");
    expect(strip).not.toBeNull();
    expect(strip!.getAttribute("data-zoom-strip")).toBe("x");
    expect(document.querySelector("[data-zoom-strip-x]")).not.toBeNull();
  });

  it("changes only the Y tick step from a wheel in the Y-axis zone", async () => {
    const svg = await render();
    await act(async () => { wheel(svg, Y_ZONE.x, Y_ZONE.y, 100); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("2");
    expect(svg.getAttribute("data-tick-step-y")).toBe("10");
    expect(svg.getAttribute("data-scale-zone")).toBe("y");
    onStep(tickValues("x"), 2);
    onStep(tickValues("y"), 10);
    expect(document.querySelector("[data-zoom-strip]")?.getAttribute("data-zoom-strip")).toBe("y");
  });

  it("keeps both tick steps fixed and zooms uniformly in the plot area", async () => {
    const svg = await render();
    const beforeX = tickValues("x").length;
    await act(async () => { wheel(svg, PLOT.x, PLOT.y, 100); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("2");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    onStep(tickValues("x"), 2);
    onStep(tickValues("y"), 5);
    expect(tickValues("x").length).toBeGreaterThan(beforeX);
  });

  it("uses the last pointer zone for the zoom in / zoom out buttons", async () => {
    const svg = await render();
    const zoomOut = document.querySelector('[aria-label="Zoom out"]') as HTMLButtonElement;
    const zoomIn = document.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement;
    await act(async () => { pointer(svg, "pointerdown", X_ZONE.x, X_ZONE.y, 1); pointer(svg, "pointerup", X_ZONE.x, X_ZONE.y, 1); });
    expect(svg.getAttribute("data-scale-zone")).toBe("x");
    await act(async () => { zoomOut.click(); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("5");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    await act(async () => { pointer(svg, "pointerdown", Y_ZONE.x, Y_ZONE.y, 1); pointer(svg, "pointerup", Y_ZONE.x, Y_ZONE.y, 1); });
    await act(async () => { zoomIn.click(); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("5");
    expect(svg.getAttribute("data-tick-step-y")).toBe("2");
  });

  it("changes the X scale from a pinch that starts in the X-axis zone", async () => {
    const svg = await render();
    await act(async () => {
      pointer(svg, "pointerdown", 500, 300, 1);
      pointer(svg, "pointerdown", 700, 300, 2);
      // Shrink the pinch (zoom out) enough to cross the 1.15 accumulator: 2 → 5.
      pointer(svg, "pointermove", 670, 300, 2);
    });
    expect(svg.getAttribute("data-tick-step-x")).toBe("5");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    expect(document.querySelector("[data-zoom-strip]")?.getAttribute("data-zoom-strip")).toBe("x");
  });

  it("snaps a new point to the edited per-axis step", async () => {
    const svg = await render();
    const toggle = document.querySelector("[data-snap-toggle]") as HTMLButtonElement;
    // Coarsen X (2 → 5) so the edited minor step is 1; always allowed, view scale unchanged.
    await act(async () => { toggle.click(); wheel(svg, X_ZONE.x, X_ZONE.y, 100); });
    expect(svg.getAttribute("data-tick-step-x")).toBe("5");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    // Place well outside both axis strips so the tap plots rather than only selecting a zone.
    const px = 400 + 3.4 * 20;
    const py = 300 - 8.4 * 20;
    await act(async () => { pointer(svg, "pointerdown", px, py, 1); pointer(svg, "pointerup", px, py, 1); });
    const snapped = placeWorldPoint(3.4, 8.4, VIEW, W, H, true, { x: 5, y: 5 });
    expect(snapped).toEqual({ x: 3, y: 8 });
    const pts = onPointsChange.mock.calls.at(-1)?.[0] as Array<{ x: number; y: number }>;
    expect(pts?.at(-1)).toEqual(snapped);
  });
});
