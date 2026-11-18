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
  };
});
vi.mock("@/lib/graph/graphTheme", () => ({
  graphInk: () => ({
    bg: "#fff", majorGrid: "#ccc", minorGrid: "#eee", axis: "#111", text: "#111", ink: "#111",
  }),
}));

const TOOL_IDS = ["none", "line", "segment", "curve", "broken", "scatter", "erase"];

describe("TableGraphScreen left tool rail", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const render = async () => {
    dom = setupDom();
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} takeRecords() { return []; } });
    await dom.render(
      <TableGraphScreen
        headers={["x", "y"]}
        cells={[["1", "2"]]}
        xCol={0}
        yCol={1}
        graphScore={{ enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }}
        onClose={() => {}}
      />,
    );
  };

  it("renders every key in the rail and does not hide any of them", async () => {
    await render();
    const rail = document.querySelector("[data-graph-tools]");
    expect(rail).not.toBeNull();
    expect(rail?.className).not.toMatch(/\bhidden\b/);
    expect(rail?.className).toMatch(/z-20/);
    for (const id of TOOL_IDS) {
      const btn = document.querySelector(`[data-tool="${id}"]`) as HTMLButtonElement | null;
      expect(btn, `missing tool ${id}`).not.toBeNull();
      expect(btn!.className).toMatch(/shrink-0/);
      expect(btn!.className).not.toMatch(/\bhidden\b/);
    }
    for (const label of ["Undo", "Clear", "Zoom in", "Zoom out", "Reset view", "Close graph"]) {
      const btn = document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement | null;
      expect(btn, `missing ${label}`).not.toBeNull();
      expect(btn!.className).not.toMatch(/\bhidden\b/);
    }
  });

  it("keeps Close pinned outside the scrollable key list so it cannot be scrolled away", async () => {
    await render();
    const scroll = document.querySelector("[data-graph-tools-scroll]");
    const close = document.querySelector("[data-close-graph]");
    expect(scroll).not.toBeNull();
    expect(close).not.toBeNull();
    expect(scroll!.contains(close)).toBe(false);
    expect(document.querySelector("[data-graph-tools]")!.contains(close)).toBe(true);
    expect(scroll!.className).toMatch(/overflow-y-auto/);
    // Tools live in the scrollable list; Close does not.
    expect(scroll!.querySelector("[data-tool]")).not.toBeNull();
    // The values panel is unchanged and still on the right of the graph.
    const panel = document.querySelector("[data-xy-panel]");
    expect(panel).not.toBeNull();
    expect(panel!.className).toMatch(/right-3/);
  });
});
