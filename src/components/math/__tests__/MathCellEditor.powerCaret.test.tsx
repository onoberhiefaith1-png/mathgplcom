/* eslint-disable @typescript-eslint/no-explicit-any */
// Smartboard / table cell editor: after a Floating Number fills an exponent,
// the next one is written on the baseline beside the power.
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MathCellEditor } from "../MathCellEditor";
vi.mock("@/components/lessonnotes/extensions/MathAssetPicker", () => ({ MathAssetPicker: () => null }));
let host: HTMLDivElement; let root: Root; let value = "";
function Editor({ insertion }: { insertion?: { nonce: number; source: string } }) {
  const [entry, setEntry] = useState("");
  return <MathCellEditor value={entry} insertion={insertion} onCommit={() => {}} onChange={(n) => { value = n; setEntry(n); }} />;
}
beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "MouseEvent"]) vi.stubGlobal(key, (dom.window as any)[key]);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { cb(); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  (dom.window.HTMLElement.prototype as any).attachEvent = () => {};
  (dom.window.HTMLElement.prototype as any).detachEvent = () => {};
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); value = "";
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it("fills the exponent placeholder, then continues on the baseline", async () => {
  await act(async () => root.render(<Editor insertion={{ nonce: 1, source: "x^{□}" }} />));
  await act(async () => root.render(<Editor insertion={{ nonce: 2, source: "2" }} />));
  await act(async () => root.render(<Editor insertion={{ nonce: 3, source: "+" }} />));
  await act(async () => root.render(<Editor insertion={{ nonce: 4, source: "1" }} />));
  expect(value.replace(/\s+/g, "")).toBe("x^{2}+1");
});
