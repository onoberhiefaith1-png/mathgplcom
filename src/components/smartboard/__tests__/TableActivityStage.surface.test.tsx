import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TableActivityStage from "../TableActivityStage";
import type { TableGroup } from "@/lib/smartboard/tableActivity";

vi.mock("@/hooks/useBoardNativeKeyboard", () => ({ useBoardNativeKeyboard: () => false }));
vi.mock("@/components/structures/StructureStage", () => ({ canRenderStructure: () => false, StructureStage: () => null }));
vi.mock("@/components/lessonnotes/SolutionObjectView", () => ({ SolutionObjectView: () => null }));
vi.mock("@/components/math/MathCellEditor", () => ({ MathCellEditor: ({ value }: { value: string }) => <input aria-label="Cell entry" value={value} readOnly /> }));

let host: HTMLDivElement;
let root: Root;
const callbacks = { onOpenChange: vi.fn(), onActivateLine: vi.fn(), onSensorCell: vi.fn(), onEntry: vi.fn() };
const group: TableGroup = {
  objId: "statistics-table", label: "Mean, variance and standard deviation", orientation: "row",
  grid: { objId: "statistics-table", label: "Statistics", rows: 5, cols: 3,
    headers: ["x", "x − μ", "(x − μ)²"], colWidths: [120, 240, 240],
    cells: [["12", "-3", "9"], ["15", "0", "0"], ["18", "3", "9"], ["13", "-2", "4"], ["17", "2", "4"]], subcells: { "0:1": { expr: "12 − 15", expected: "−3" } }, advanced: true },
  retained: [], memberLineIdxs: [0, 1, 2, 3, 4], subcellLineIdxs: { "0:1": 5 }, tableIndex: 1, branchPrefix: "T",
};
beforeEach(() => {
  vi.clearAllMocks();
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "MouseEvent"]) vi.stubGlobal(key, (dom.window as any)[key]);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(fitToSurface: boolean, sensorCell = "0:0", entries = { "0:0": "12", "sub:0:1": "Subtract the mean from the observation and retain all working." }) {
  await act(async () => root.render(<TableActivityStage group={group} activeLineIdx={0}
    entries={entries}
    sensorCell={sensorCell} open editable lessonNoteFidelity fitToSurface={fitToSurface} {...callbacks} />));
}
describe("normal Game table surface", () => {
  it("renders all rows and columns with responsive widths instead of an inner scroll area", async () => {
    await render(true);
    const table = host.querySelector("table")!;
    expect(table.querySelectorAll("thead th")).toHaveLength(3);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(table.querySelectorAll("tbody td")).toHaveLength(15);
    expect(table.style.width).toBe("100%"); expect(table.style.tableLayout).toBe("fixed");
    expect([...table.querySelectorAll("col")].map(c => c.style.width)).toEqual(["20%", "40%", "40%"]);
    expect(host.querySelectorAll(".overflow-auto")).toHaveLength(0);
    expect([...host.querySelectorAll("button")].some(b => /expand|shrink/i.test(b.textContent ?? ""))).toBe(false);
  });
  it("keeps supporting working visible and allows it to wrap", async () => {
    await render(true);
    expect(host.textContent).toContain("Subtract the mean from the observation and retain all working.");
    expect(host.querySelector('[data-subcell-working-content]')?.className).toContain("min-w-0");
    expect(host.querySelector('[data-subcell-working-content]')?.className).toContain("whitespace-pre-wrap");
  });
  it("keeps cell selection and editing on the same live table", async () => {
    await render(true);
    const cell = host.querySelector("tbody td")!;
    await act(async () => cell.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(callbacks.onSensorCell).toHaveBeenCalledWith("0:0");
    expect(host.querySelector('input[aria-label="Cell entry"]')).not.toBeNull();
    expect(host.querySelectorAll("table")).toHaveLength(1);
  });
  it("preserves the existing table treatment outside the new Game mode", async () => {
    await render(false);
    const table = host.querySelector("table")!;
    expect(table.style.tableLayout).toBe("");
    expect(host.querySelector(".overflow-auto")).not.toBeNull();
    expect(table.querySelector("col")?.style.width).toBe("120px");
  });
  it("Advance hides and restores working without replacing the answer cells", async () => {
    await render(true);
    const advance = [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === "Advance")!;
    expect(advance.getAttribute("aria-pressed")).toBe("true");
    await act(async () => advance.click());
    expect(host.querySelector("[data-subcell-working-content]")).toBeNull();
    expect(host.querySelectorAll("tbody td")).toHaveLength(15);
    await act(async () => advance.click());
    expect(host.textContent).toContain("Subtract the mean from the observation");
  });
  it("the working above the blue line selects its own Subcell floating-number branch", async () => {
    await render(true);
    const working = host.querySelectorAll("[data-subcell-working-row]")[1] as HTMLElement;
    await act(async () => working.click());
    expect(callbacks.onSensorCell).toHaveBeenCalledWith("sub:0:1");
    expect(callbacks.onActivateLine).toHaveBeenCalledWith(5);
  });
  it("Calculate writes the active Subcell result below while preserving its expression", async () => {
    await render(true, "sub:0:1", { "0:0": "12", "sub:0:1": "12-15" });
    const calculate = [...host.querySelectorAll("button")].find(b => b.title.startsWith("Work out the active Subcell"))!;
    expect(calculate).toBeDefined();
    await act(async () => calculate.click());
    expect(callbacks.onEntry).toHaveBeenCalledWith("0:1", "-3");
    expect(callbacks.onEntry.mock.calls.some(([key]) => key === "sub:0:1")).toBe(false);
  });
});
