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
    toPx: () => ({ x: 0, y: 0 }),
    zoomAt: (v: typeof view) => v,
    zoomFactorFromWheel: () => 1,
    placeWorldPoint: (x: number, y: number) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }),
    tickStepFromPoints: () => ({ x: 1, y: 1 }),
    adjacentNiceStep: (s: number) => s,
    nudgeTickStep: (step: { x: number; y: number }) => step,
    zoomZone: () => ({ axis: "both" as const, highlight: "none" as const }),
    zoomStripRects: () => ({
      vertical: { x: 0, y: 0, width: 0, height: 0 },
      horizontal: { x: 0, y: 0, width: 0, height: 0 },
    }),
  };
});
vi.mock("@/lib/graph/graphTheme", () => ({
  graphInk: () => ({
    bg: "#fff", majorGrid: "#ccc", minorGrid: "#eee", axis: "#111", text: "#111", ink: "#111",
  }),
}));

describe("TableGraphScreen close", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  it("Close returns to the caller without reloading or navigating", async () => {
    const onClose = vi.fn();
    const reload = vi.fn();
    const back = vi.fn();
    dom = setupDom();
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    vi.stubGlobal("location", { ...window.location, reload });
    vi.spyOn(window.history, "back").mockImplementation(back);
    await dom.render(
      <TableGraphScreen
        headers={["x", "y"]}
        cells={[["1", "2"], ["3", "4"]]}
        xCol={0}
        yCol={1}
        graphScore={{ enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }}
        onClose={onClose}
      />,
    );
    const close = document.querySelector("[data-close-graph]") as HTMLButtonElement | null;
    expect(close).not.toBeNull();
    expect(close?.getAttribute("type")).toBe("button");
    expect(document.querySelector("[data-table-graph-screen]")).not.toBeNull();
    await act(async () => close!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("Escape closes the graph without a history back", async () => {
    const onClose = vi.fn();
    const back = vi.fn();
    dom = setupDom();
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    vi.spyOn(window.history, "back").mockImplementation(back);
    await dom.render(
      <TableGraphScreen
        headers={["x", "y"]}
        cells={[["0", "0"]]}
        xCol={0}
        yCol={1}
        graphScore={{ enabled: false, maxCoordinates: 7, marksPerCoordinate: 2 }}
        onClose={onClose}
      />,
    );
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });
});
