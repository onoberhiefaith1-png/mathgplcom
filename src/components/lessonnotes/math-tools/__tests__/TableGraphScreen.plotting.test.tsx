import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";
import { TableGraphScreen } from "../TableGraphScreen";
import { PLOT_COLORS } from "@/lib/lessonnotes/tableGraph";

vi.mock("@/lib/graph/digitalView", () => {
  const view = { cx: 0, cy: 0, scaleX: 20, scaleY: 20 };
  return {
    fitPoints: () => view,
    gridLines: () => ({ vertical: [], horizontal: [] }),
    panView: (v: typeof view) => v,
    toData: (px: number, py: number) => ({ x: (px - 40) / 20, y: (40 - py) / 20 }),
    toPx: (p: { x: number; y: number }) => ({ x: 40 + p.x * 20, y: 40 - p.y * 20 }),
    zoomAt: (v: typeof view) => v,
    zoomFactorFromWheel: () => 1,
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

describe("TableGraphScreen plotting toggle", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const render = async (extra: Record<string, unknown> = {}) => {
    const onPointsChange = vi.fn();
    dom = setupDom();
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    await dom.render(
      <TableGraphScreen
        headers={["x", "y"]}
        cells={[["0", "1"], ["1", "3"]]}
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

  const fireAt = (svg: Element, x: number, y: number) => {
    const fire = (type: string) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1 });
      svg.dispatchEvent(ev);
    };
    fire("pointerdown");
    fire("pointerup");
  };

  it("puts a clear Plotting on/off toggle in the left rail, on by default", async () => {
    await render();
    const toggle = document.querySelector("[data-plotting-toggle]") as HTMLButtonElement | null;
    const rail = document.querySelector("[data-graph-tools-scroll]");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-label")).toBe("Plotting");
    expect(toggle!.getAttribute("aria-pressed")).toBe("true");
    expect(toggle!.getAttribute("data-plotting")).toBe("on");
    expect(toggle!.className).toMatch(/shrink-0/);
    expect(rail).toContain(toggle);
  });

  it("does not add points while plotting is off, and starts a new separate line when it is turned back on", async () => {
    const onChange = await render();
    const svg = document.querySelector("[data-table-graph-canvas]") as SVGSVGElement;
    const lineBtn = document.querySelector('[data-tool="line"]') as HTMLButtonElement;
    const toggle = document.querySelector("[data-plotting-toggle]") as HTMLButtonElement;
    const blue = PLOT_COLORS[2];
    const swatch = document.querySelector(`[data-color-swatch="${blue}"]`) as HTMLButtonElement;

    await act(async () => lineBtn.click());
    await act(async () => fireAt(svg, 40, 40));
    await act(async () => fireAt(svg, 80, 20));
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]);
    expect(onChange.mock.calls.at(-1)?.[4]).toHaveLength(1);

    await act(async () => toggle.click());
    expect(toggle.getAttribute("data-plotting")).toBe("off");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    const callsAfterOff = onChange.mock.calls.length;
    await act(async () => fireAt(svg, 120, 0));
    expect(onChange.mock.calls.length).toBe(callsAfterOff);
    expect(document.querySelectorAll("[data-plot-series]")).toHaveLength(1);

    await act(async () => swatch.click());
    await act(async () => toggle.click());
    expect(toggle.getAttribute("data-plotting")).toBe("on");
    await act(async () => fireAt(svg, 120, 0));
    await act(async () => fireAt(svg, 160, -20));
    const series = onChange.mock.calls.at(-1)?.[4] as Array<{ points: unknown[]; color: string }>;
    expect(series).toHaveLength(2);
    expect(series[0].points).toEqual([{ x: 0, y: 0 }, { x: 2, y: 1 }]);
    expect(series[1].points).toEqual([{ x: 4, y: 2 }, { x: 6, y: 3 }]);
    expect(series[1].color).toBe(blue);
    expect(document.querySelectorAll("[data-plot-series]")).toHaveLength(2);
    // The two paths stay separate — no single path joining both lines.
    expect(document.querySelectorAll("path[data-plot-color]")).toHaveLength(2);
  });
});
