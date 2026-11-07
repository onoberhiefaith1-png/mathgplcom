import { JSDOM } from "jsdom";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

/** Minimal jsdom + React root for component tests (same pattern as TableActivityStage tests). */
export const setupDom = () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "Element", "Event", "Node", "MouseEvent", "PointerEvent", "KeyboardEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
    const value = (dom.window as any)[key];
    if (value !== undefined) vi.stubGlobal(key, typeof value === "function" && /^[a-z]/.test(key) ? value.bind(dom.window) : value);
  }
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const host = document.createElement("div");
  document.body.append(host);
  const root: Root = createRoot(host);
  return {
    host,
    render: async (el: ReactElement) => { await act(async () => root.render(el)); },
    cleanup: async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); },
  };
};
