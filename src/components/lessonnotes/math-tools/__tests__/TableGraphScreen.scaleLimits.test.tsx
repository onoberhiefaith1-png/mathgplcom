import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";
import { minorStepOf } from "@/lib/graph/digitalView";
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
const ORIGIN = { x: 400, y: 300 };
// One minor cell: X-zone half-height = 1 * 20 = 20; Y-zone half-width = 0.4 * 20 = 8.
const X_ZONE = { x: 600, y: 300 };
const Y_ZONE = { x: 400, y: 100 };
const PLOT = { x: 600, y: 100 };

describe("TableGraphScreen scale limits and one-cell zone", () => {
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

  it("paints the axis-zone highlight exactly one minor grid cell either side", async () => {
    const svg = await render();
    await act(async () => { pointer(svg, "pointerdown", X_ZONE.x, X_ZONE.y, 1); });
    const strip = document.querySelector("[data-zoom-strip-x]") as SVGRectElement | null;
    expect(strip).not.toBeNull();
    const half = minorStepOf(STEP.y) * 20;
    expect(Number(strip!.getAttribute("height"))).toBeCloseTo(half * 2);
    expect(Number(strip!.getAttribute("y"))).toBeCloseTo(ORIGIN.y - half);
    await act(async () => {
      pointer(svg, "pointerup", X_ZONE.x, X_ZONE.y, 1);
      pointer(svg, "pointerdown", Y_ZONE.x, Y_ZONE.y, 1);
    });
    const yStrip = document.querySelector("[data-zoom-strip-y]") as SVGRectElement | null;
    expect(yStrip).not.toBeNull();
    const halfX = minorStepOf(STEP.x) * 20;
    expect(Number(yStrip!.getAttribute("width"))).toBeCloseTo(halfX * 2);
    expect(Number(yStrip!.getAttribute("x"))).toBeCloseTo(ORIGIN.x - halfX);
  });

  it("does not treat a pointer just past one grid cell as an axis zone", async () => {
    const svg = await render();
    const zoomOut = document.querySelector('[aria-label="Zoom out"]') as HTMLButtonElement;
    const beforeX = tickValues("x").length;
    // One pixel past the X-axis minor band (20px) should uniform-zoom, not change the step.
    await act(async () => {
      pointer(svg, "pointerdown", X_ZONE.x, ORIGIN.y + 21, 1);
      pointer(svg, "pointerup", X_ZONE.x, ORIGIN.y + 21, 1);
      zoomOut.click();
    });
    expect(svg.getAttribute("data-tick-step-x")).toBe("2");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
    expect(tickValues("x").length).toBeGreaterThan(beforeX);
  });

  it("stops refining the scale when the next labels would collide, and shows a limit cue", async () => {
    const svg = await render();
    const zoomIn = document.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement;
    await act(async () => { pointer(svg, "pointerdown", X_ZONE.x, X_ZONE.y, 1); pointer(svg, "pointerup", X_ZONE.x, X_ZONE.y, 1); });
    let last = svg.getAttribute("data-tick-step-x");
    let limited = false;
    for (let i = 0; i < 16; i++) {
      await act(async () => { zoomIn.click(); });
      const now = svg.getAttribute("data-tick-step-x");
      if (svg.getAttribute("data-scale-limit") === "x" && now === last) {
        limited = true;
        break;
      }
      last = now;
    }
    expect(limited).toBe(true);
    expect(svg.getAttribute("data-tick-stride-x")).toBe("1");
    const xs = tickValues("x").sort((a, b) => a - b);
    const step = Number(svg.getAttribute("data-tick-step-x"));
    for (const v of xs) expect(v / step).toBeCloseTo(Math.round(v / step), 8);
    // Adjacent shown labels are at least one current step apart (no duplicates / overlap run).
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1] + 1e-9).toBeGreaterThanOrEqual(step);
  });

  it("keeps the user's step when zooming out and thins labels instead of overlapping", async () => {
    const svg = await render();
    const zoomOut = document.querySelector('[aria-label="Zoom out"]') as HTMLButtonElement;
    const beforeX = svg.getAttribute("data-tick-step-x");
    const beforeY = svg.getAttribute("data-tick-step-y");
    await act(async () => {
      for (let i = 0; i < 8; i++) zoomOut.click();
    });
    expect(svg.getAttribute("data-tick-step-x")).toBe(beforeX);
    expect(svg.getAttribute("data-tick-step-y")).toBe(beforeY);
    const stride = Number(svg.getAttribute("data-tick-stride-x"));
    expect(stride).toBeGreaterThan(1);
    const xs = tickValues("x").sort((a, b) => a - b);
    const step = Number(beforeX);
    for (let i = 1; i < xs.length; i++) {
      const gap = xs[i] - xs[i - 1];
      const acrossOrigin = xs[i - 1] < 0 && xs[i] > 0;
      expect(gap).toBeCloseTo(step * stride * (acrossOrigin ? 2 : 1), 8);
    }
  });

  it("debounces a burst of wheel events so one gesture only takes one scale step", async () => {
    const svg = await render();
    await act(async () => {
      for (let i = 0; i < 8; i++) wheel(svg, X_ZONE.x, X_ZONE.y, 100);
    });
    // One 2 → 5 step, not a jump along the ladder to 10/20/50.
    expect(svg.getAttribute("data-tick-step-x")).toBe("5");
    expect(svg.getAttribute("data-tick-step-y")).toBe("5");
  });
});
