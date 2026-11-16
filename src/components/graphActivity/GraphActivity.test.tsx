import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GraphActivity from "./GraphActivity";
import { DEFAULT_GRAPH_TABLE } from "@/lib/graphActivity/table";

let host: HTMLDivElement;
let root: Root;

const CANVAS_W = 800;
const CANVAS_H = 700;

const box = { x: 0, y: 0, left: 0, top: 0, right: CANVAS_W, bottom: CANVAS_H, width: CANVAS_W, height: CANVAS_H, toJSON: () => ({}) };

function installPointerEvent(win: Window) {
  const w = win as Window & { PointerEvent?: typeof PointerEvent; MouseEvent: typeof MouseEvent };
  if (typeof w.PointerEvent === "function") return;
  class PointerEventPolyfill extends w.MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = true;
    }
  }
  vi.stubGlobal("PointerEvent", PointerEventPolyfill);
  (w as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
}

function firePointer(el: Element, type: string, clientX: number, clientY: number) {
  const Ctor = (window as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent;
  const ev = new Ctor(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "mouse",
    buttons: type === "pointerup" ? 0 : 1,
    view: window,
  });
  el.dispatchEvent(ev);
}

function clickCanvasAt(x: number, y: number) {
  const canvas = host.querySelector("canvas");
  if (!canvas) throw new Error("no canvas");
  firePointer(canvas, "pointerdown", x, y);
  firePointer(canvas, "pointerup", x, y);
}

function liveView() {
  const wrap = host.querySelector("[data-ga-canvas]") as HTMLElement | null;
  if (!wrap) throw new Error("no canvas wrap");
  return {
    cx: Number(wrap.dataset.cx),
    cy: Number(wrap.dataset.cy),
    scale: Number(wrap.dataset.scale),
  };
}

function worldToCanvas(x: number, y: number) {
  const view = liveView();
  const rect = host.querySelector("canvas")?.getBoundingClientRect() ?? box;
  return {
    x: rect.left + rect.width / 2 + (x - view.cx) * view.scale,
    y: rect.top + rect.height / 2 - (y - view.cy) * view.scale,
  };
}

function readout() {
  const m = host.textContent?.match(/\(x, y\) = \((-?[0-9.]+), (-?[0-9.]+)\)/);
  if (!m) throw new Error("no readout");
  return { x: Number(m[1]), y: Number(m[2]) };
}

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "MouseEvent", "HTMLCanvasElement"]) {
    vi.stubGlobal(key, (dom.window as unknown as Record<string, unknown>)[key]);
  }
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class {
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.cb = cb; }
    observe(el: Element) { this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
    unobserve() {}
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; }, onchange: null,
  }));
  installPointerEvent(dom.window as unknown as Window);
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { configurable: true, get: () => CANVAS_W });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { configurable: true, get: () => CANVAS_H });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => box as DOMRect;
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "clientWidth", { configurable: true, get: () => CANVAS_W });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "clientHeight", { configurable: true, get: () => CANVAS_H });
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

  it("adds a point when the Point tool clicks the canvas", async () => {
    await act(async () => root.render(<GraphActivity table={DEFAULT_GRAPH_TABLE} startCollapsed={false} />));
    const plus = host.querySelector('button[aria-label="Open tools"]') as HTMLButtonElement;
    await act(async () => { plus.click(); });
    const pointBtn = Array.from(host.querySelectorAll(".ga-tools button")).find((b) => b.textContent?.includes("Point")) as HTMLButtonElement;
    await act(async () => { pointBtn.click(); });
    const at = worldToCanvas(-2, -1);
    await act(async () => { clickCanvasAt(at.x, at.y); });
    expect(readout().x).toBeCloseTo(-2, 1);
    expect(readout().y).toBeCloseTo(-1, 1);
  });

  it("plots the five table points and scores 5/5 on Check Graph", async () => {
    await act(async () => root.render(<GraphActivity table={DEFAULT_GRAPH_TABLE} startCollapsed={false} />));
    for (const p of DEFAULT_GRAPH_TABLE) {
      const at = worldToCanvas(p.x, p.y);
      await act(async () => { clickCanvasAt(at.x, at.y); });
    }
    const check = host.querySelector('[data-testid="ga-check"]') as HTMLButtonElement;
    await act(async () => { check.click(); });
    expect(host.textContent).toMatch(/5 of 5 points/);
    expect(host.querySelector('[data-testid="ga-result"]')).toBeTruthy();
    const missed = host.querySelectorAll('.ga-result li[data-status="missed"]');
    expect(missed).toHaveLength(0);
  });

  it("Line, Curve, Broken and Scatter still add points, and Eraser removes the nearest", async () => {
    await act(async () => root.render(<GraphActivity table={DEFAULT_GRAPH_TABLE} startCollapsed={false} />));
    const openTools = async (label: string) => {
      const plus = host.querySelector('button[aria-label="Open tools"]') as HTMLButtonElement;
      await act(async () => { plus.click(); });
      const btn = Array.from(host.querySelectorAll(".ga-tools button")).find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
      await act(async () => { btn.click(); });
    };
    await openTools("Line");
    const a = worldToCanvas(-2, -1);
    await act(async () => { clickCanvasAt(a.x, a.y); });
    await openTools("Curve");
    const b = worldToCanvas(-1, 1);
    await act(async () => { clickCanvasAt(b.x, b.y); });
    await openTools("Broken");
    const c = worldToCanvas(0, 3);
    await act(async () => { clickCanvasAt(c.x, c.y); });
    await openTools("Scatter");
    const d = worldToCanvas(1, 5);
    await act(async () => { clickCanvasAt(d.x, d.y); });
    expect(readout().x).toBeCloseTo(1, 1);
    expect(readout().y).toBeCloseTo(5, 1);
    await openTools("Eraser");
    await act(async () => { clickCanvasAt(d.x, d.y); });
    expect(readout().x).toBeCloseTo(0, 1);
    expect(readout().y).toBeCloseTo(3, 1);
  });
});
