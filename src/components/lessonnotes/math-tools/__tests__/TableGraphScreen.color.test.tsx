import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";
import { TableGraphScreen } from "../TableGraphScreen";
import { DEFAULT_PLOT_COLOR, PLOT_COLORS } from "@/lib/lessonnotes/tableGraph";

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
    tickStepFromPoints: () => ({ x: 1, y: 1 }),
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

describe("TableGraphScreen line colour palette", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const render = async (extra: Partial<React.ComponentProps<typeof TableGraphScreen>> = {}) => {
    const onPointsChange = vi.fn();
    dom = setupDom();
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    await dom.render(
      <TableGraphScreen
        headers={["x", "y"]}
        cells={[["0", "0"], ["1", "2"]]}
        xCol={0}
        yCol={1}
        graphScore={{ enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }}
        onClose={() => {}}
        onPointsChange={onPointsChange}
        {...extra}
      />,
    );
    return onPointsChange;
  };

  it("places a 6-to-8 swatch palette on the right, below the values panel, without covering it", async () => {
    await render();
    const stack = document.querySelector("[data-graph-right-stack]");
    const panel = document.querySelector("[data-xy-panel]");
    const palette = document.querySelector("[data-color-palette]");
    expect(stack).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(palette).not.toBeNull();
    expect(stack!.className).toMatch(/right-3/);
    expect(panel!.className).toMatch(/right-3/);
    expect(stack!.className).toMatch(/flex-col/);
    // Palette is after the values panel in the same right-hand stack.
    const children = [...stack!.children];
    expect(children.indexOf(panel as Element)).toBeGreaterThanOrEqual(0);
    expect(children.indexOf(palette as Element)).toBeGreaterThan(children.indexOf(panel as Element));
    const swatches = document.querySelectorAll("[data-color-swatch]");
    expect(swatches.length).toBe(PLOT_COLORS.length);
    expect(swatches.length).toBeGreaterThanOrEqual(6);
    expect(swatches.length).toBeLessThanOrEqual(8);
  });

  it("paints a saved colour on the existing series, and defaults older plots to the current ink", async () => {
    await render({
      initialPoints: [{ x: 0, y: 0 }, { x: 1, y: 2 }],
      initialConnect: "line",
      initialColor: "#DC2626",
    });
    const path = document.querySelector("path[data-plot-color]") as SVGPathElement | null;
    expect(path).not.toBeNull();
    expect(path!.getAttribute("data-plot-color")).toBe("#DC2626");
    expect(path!.getAttribute("stroke")).toBe("#DC2626");

    await dom.cleanup();
    await render({
      initialPoints: [{ x: 0, y: 0 }, { x: 1, y: 2 }],
      initialConnect: "line",
    });
    const legacy = document.querySelector("path[data-plot-color]") as SVGPathElement | null;
    expect(legacy!.getAttribute("data-plot-color")).toBe(DEFAULT_PLOT_COLOR);
    // Default charcoal follows the theme ink (#111 in this mock).
    expect(legacy!.getAttribute("stroke")).toBe("#111");
  });

  it("applies the selected colour to a new line, and only recolours an existing line after it is tapped", async () => {
    const onChange = await render();
    const blue = PLOT_COLORS[2];
    const swatch = document.querySelector(`[data-color-swatch="${blue}"]`) as HTMLButtonElement;
    expect(swatch).not.toBeNull();
    await act(async () => swatch.click());
    // No points yet: the pen colour is saved for the new line.
    expect(onChange).toHaveBeenCalled();
    const first = onChange.mock.calls.at(-1);
    expect(first?.[3]).toBe(blue);
    expect(first?.[0]).toEqual([]);

    await dom.cleanup();
    const onChange2 = await render({
      initialPoints: [{ x: 0, y: 0 }, { x: 1, y: 2 }],
      initialConnect: "line",
      initialColor: DEFAULT_PLOT_COLOR,
    });
    const red = PLOT_COLORS[1];
    const redSwatch = document.querySelector(`[data-color-swatch="${red}"]`) as HTMLButtonElement;
    await act(async () => redSwatch.click());
    // Line is not selected yet, so the existing series keeps its colour.
    expect(onChange2).not.toHaveBeenCalled();
    expect(document.querySelector("path[data-plot-color]")!.getAttribute("data-plot-color")).toBe(DEFAULT_PLOT_COLOR);

    const svg = document.querySelector("[data-table-graph-canvas]") as SVGSVGElement;
    const fire = (type: string) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(ev, { clientX: 40, clientY: 40, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1 });
      svg.dispatchEvent(ev);
    };
    await act(async () => { fire("pointerdown"); fire("pointerup"); });
    expect(document.querySelector("path[data-plot-color]")!.getAttribute("data-selected-series")).toBe("true");
    await act(async () => redSwatch.click());
    expect(onChange2).toHaveBeenCalled();
    expect(onChange2.mock.calls.at(-1)?.[3]).toBe(red);
    expect(document.querySelector("path[data-plot-color]")!.getAttribute("data-plot-color")).toBe(red);
    expect(document.querySelector("path[data-plot-color]")!.getAttribute("stroke")).toBe(red);
  });
});
