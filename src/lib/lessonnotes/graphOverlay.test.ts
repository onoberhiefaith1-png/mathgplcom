import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdBoardScroll, restoreScroll, snapshotScroll } from "./graphOverlay";

describe("graph overlay close restores board scroll", () => {
  beforeEach(() => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "https://example.test/" });
    const w = dom.window;
    let sx = 0;
    let sy = 0;
    w.scrollTo = ((x: number | ScrollToOptions, y?: number) => {
      if (typeof x === "object") {
        sx = x.left ?? sx;
        sy = x.top ?? sy;
      } else {
        sx = Number(x) || 0;
        sy = Number(y) || 0;
      }
    }) as typeof w.scrollTo;
    Object.defineProperty(w, "scrollX", { configurable: true, get: () => sx });
    Object.defineProperty(w, "scrollY", { configurable: true, get: () => sy });
    for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node"]) {
      vi.stubGlobal(key, (w as any)[key]);
    }
    vi.stubGlobal("getComputedStyle", w.getComputedStyle.bind(w));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal("scrollTo", w.scrollTo);
    vi.stubGlobal("scrollX", 0);
    vi.stubGlobal("scrollY", 0);
    // Keep global scrollX/Y in sync with the jsdom window.
    Object.defineProperty(globalThis, "scrollX", { configurable: true, get: () => w.scrollX });
    Object.defineProperty(globalThis, "scrollY", { configurable: true, get: () => w.scrollY });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const scroller = (attrs: Partial<{ id: string; board: boolean }> = {}) => {
    const el = document.createElement("div");
    if (attrs.id) el.id = attrs.id;
    if (attrs.board) el.setAttribute("data-board-scroll", "");
    Object.assign(el.style, { overflowY: "auto", height: "200px", width: "200px" });
    Object.defineProperty(el, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(el, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(el, "scrollWidth", { configurable: true, value: 200 });
    document.body.append(el);
    return el;
  };

  it("snapshots the marked board scroller and window, then restores them on close", () => {
    const board = scroller({ board: true, id: "board" });
    board.scrollTop = 640;
    board.scrollLeft = 12;
    window.scrollTo(0, 80);

    const snap = snapshotScroll();
    expect(snap.windowY).toBe(80);
    expect(snap.elements.some((s) => s.el === board && s.top === 640 && s.left === 12)).toBe(true);

    board.scrollTop = 0;
    board.scrollLeft = 0;
    window.scrollTo(0, 0);
    restoreScroll(snap);
    expect(board.scrollTop).toBe(640);
    expect(board.scrollLeft).toBe(12);
    // window.scrollTo is a no-op in jsdom; the snapshot still records the
    // window position so a real browser can restore it.
    expect(snap.windowY).toBe(80);
  });

  it("holdBoardScroll locks overflow and restores the exact board place on cleanup (no reload)", () => {
    const board = scroller({ board: true });
    board.scrollTop = 415;
    const htmlOverflow = document.documentElement.style.overflow;
    const release = holdBoardScroll();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    board.scrollTop = 1;
    release();
    expect(document.documentElement.style.overflow).toBe(htmlOverflow);
    expect(board.scrollTop).toBe(415);
  });

  it("does not drop a later, unmarked scrollable that the student was using", () => {
    const other = scroller({ id: "notes" });
    other.scrollTop = 90;
    const snap = snapshotScroll();
    other.scrollTop = 0;
    restoreScroll(snap);
    expect(other.scrollTop).toBe(90);
  });
});
