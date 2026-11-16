import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GraphActivity from "./GraphActivity";
import { DEFAULT_GRAPH_TABLE } from "@/lib/graphActivity/table";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "MouseEvent", "HTMLCanvasElement"]) {
    vi.stubGlobal(key, (dom.window as unknown as Record<string, unknown>)[key]);
  }
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; }, onchange: null,
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    arc() {}, fillText() {}, bezierCurveTo() {}, setLineDash() {},
  } as unknown as CanvasRenderingContext2D);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GraphActivity", () => {
  it("renders the design chrome and the default x/y table", async () => {
    await act(async () => root.render(<GraphActivity table={DEFAULT_GRAPH_TABLE} theme="light" startCollapsed={false} />));
    expect(host.querySelector('[aria-label="Graph Activity"]')).toBeTruthy();
    expect(host.textContent).toContain("Smart Table");
    expect(host.textContent).toContain("Rows 1");
    expect(host.textContent).toMatch(/\(x, y\) = /);
    const check = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Check Graph"));
    expect(check).toBeTruthy();
    expect(Array.from(host.querySelectorAll("button")).some((b) => b.getAttribute("aria-label") === "Zoom in")).toBe(true);
    expect(Array.from(host.querySelectorAll("button")).some((b) => b.getAttribute("aria-label") === "Pan")).toBe(true);
    const cells = Array.from(host.querySelectorAll("td")).map((td) => td.textContent);
    expect(cells).toContain("-2");
    expect(cells).toContain("-1");
    expect(cells).toContain("3");
  });

  it("grades on Check Graph and reports a score", async () => {
    await act(async () => root.render(<GraphActivity table={DEFAULT_GRAPH_TABLE} startCollapsed={false} />));
    const check = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Check Graph"))!;
    await act(async () => { check.click(); });
    expect(host.textContent).toMatch(/0 of 5 points/);
    expect(host.querySelector(".ga-result")).toBeTruthy();
  });
});
