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

const VIEW = { cx: 0, cy: 0, scaleX: 20, scaleY: 20 };
const W = 800, H = 600;

describe("TableGraphScreen snap-to-grid toggle", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const pinSize = () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => W });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => H });
  };

  const render = async (extra: Record<string, unknown> = {}) => {
    const onPointsChange = vi.fn();
    dom = setupDom();
    pinSize();
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
    await dom.render(
      <TableGraphScreen
        headers={["x", "y"]}
        cells={[["0", "0"], ["4", "4"]]}
        xCol={0}
        yCol={1}
        graphScore={{ enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }}
        teacherAxes={{ xCol: 0, yCol: 1 }}
        onClose={() => {}}
        onPointsChange={onPointsChange}
        {...extra}
      />,
    );
    const svg = document.querySelector("[data-table-graph-canvas]") as SVGSVGElement;
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: W, bottom: H, width: W, height: H, toJSON() { return {}; },
    });
    return { onPointsChange, svg };
  };

  const fireAt = (svg: Element, x: number, y: number, pointerId = 1) => {
    const fire = (type: string) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(ev, { clientX: x, clientY: y, pointerId, pointerType: "mouse", isPrimary: pointerId === 1, button: 0, buttons: type === "pointerup" ? 0 : 1 });
      svg.dispatchEvent(ev);
    };
    fire("pointerdown");
    fire("pointerup");
  };

  it("puts a Snap to grid toggle in the left rail, off by default", async () => {
    await render();
    const toggle = document.querySelector("[data-snap-toggle]") as HTMLButtonElement | null;
    const rail = document.querySelector("[data-graph-tools-scroll]");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-label")).toBe("Snap to grid");
    expect(toggle!.getAttribute("aria-pressed")).toBe("false");
    expect(toggle!.getAttribute("data-snap")).toBe("off");
    expect(rail).toContain(toggle);
  });

  it("snaps a placed point to the current minor grid and grades the snapped coordinates", async () => {
    const { onPointsChange, svg } = await render();
    const raw = { x: 1.4, y: 1.05 };
    const px = W / 2 + raw.x * VIEW.scaleX;
    const py = H / 2 - raw.y * VIEW.scaleY;
    const toggle = document.querySelector("[data-snap-toggle]") as HTMLButtonElement;

    await act(async () => fireAt(svg, px, py));
    const offPt = onPointsChange.mock.calls.at(-1)?.[0]?.[0];
    expect(offPt).toEqual(placeWorldPoint(raw.x, raw.y, VIEW, W, H, false));
    expect(offPt).toEqual({ x: 1.4, y: 1.1 });

    await act(async () => toggle.click());
    expect(toggle.getAttribute("data-snap")).toBe("on");
    // A different world point, far from the first, so the click is not treated as a hit on it.
    const rawOn = { x: -3.4, y: 2.15 };
    const pxOn = W / 2 + rawOn.x * VIEW.scaleX;
    const pyOn = H / 2 - rawOn.y * VIEW.scaleY;
    await act(async () => fireAt(svg, pxOn, pyOn));
    const onPts = onPointsChange.mock.calls.at(-1)?.[0] as Array<{ x: number; y: number }>;
    const snapped = placeWorldPoint(rawOn.x, rawOn.y, VIEW, W, H, true);
    expect(onPts[1]).toEqual(snapped);
    expect(snapped).toEqual({ x: -3, y: 2 });
    const result = onPointsChange.mock.calls.at(-1)?.[2] as { perPoint: Array<{ correct: boolean }>; earned: number };
    expect(result.perPoint[1].correct).toBe(false);
  });
});
