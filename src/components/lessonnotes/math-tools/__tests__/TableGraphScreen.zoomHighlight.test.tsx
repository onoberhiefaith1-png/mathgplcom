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

describe("TableGraphScreen zoom-strip highlight", () => {
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
        cells={[["0", "1"]]}
        xCol={0}
        yCol={1}
        graphScore={{ enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }}
        onClose={() => {}}
      />,
    );
    const svg = document.querySelector("[data-table-graph-canvas]") as SVGSVGElement;
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: W, bottom: H, width: W, height: H, toJSON() { return {}; },
    });
    return svg;
  };

  const pointer = (svg: Element, type: string, x: number, y: number, pointerId: number) => {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, { clientX: x, clientY: y, pointerId, pointerType: "touch", isPrimary: pointerId === 1, button: 0, buttons: type === "pointerup" ? 0 : 1 });
    svg.dispatchEvent(ev);
  };

  it("shows the faint strip highlight on a wheel zoom in the X-axis zone", async () => {
    const svg = await render();
    await act(async () => {
      const ev = new Event("wheel", { bubbles: true, cancelable: true });
      Object.assign(ev, { clientX: 600, clientY: 300, deltaY: -100, deltaMode: 0 });
      svg.dispatchEvent(ev);
    });
    const strip = document.querySelector("[data-zoom-strip]");
    expect(strip).not.toBeNull();
    expect(strip!.getAttribute("data-zoom-strip")).toBe("x");
    expect(document.querySelector("[data-zoom-strip-x]")).not.toBeNull();
  });

  it("shows the same faint strip highlight on a pinch in the X-axis zone", async () => {
    const svg = await render();
    await act(async () => {
      pointer(svg, "pointerdown", 500, 300, 1);
      pointer(svg, "pointerdown", 700, 300, 2);
      pointer(svg, "pointermove", 780, 300, 2);
    });
    const strip = document.querySelector("[data-zoom-strip]");
    expect(strip).not.toBeNull();
    expect(strip!.getAttribute("data-zoom-strip")).toBe("x");
    expect(document.querySelector("[data-zoom-strip-x]")).not.toBeNull();
  });
});
