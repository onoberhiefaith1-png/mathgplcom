import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { MathCellEditor } from "../MathCellEditor";
vi.mock("@/components/lessonnotes/extensions/MathAssetPicker", () => ({ MathAssetPicker: () => null }));
let host: HTMLDivElement;
let root: Root;
let value = "";
function Editor({ insertion, external }: { insertion?: { nonce: number; source: string }; external?: string }) {
  const [entry, setEntry] = useState("");
  return <MathCellEditor value={external ?? entry} insertion={insertion} onCommit={() => {}}
    onChange={next => { value = next; setEntry(next); }} />;
}
beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "MouseEvent"]) vi.stubGlobal(key, (dom.window as any)[key]);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { cb(); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  // React was imported before jsdom: provide the legacy input-event hooks.
  (dom.window.HTMLElement.prototype as any).attachEvent = () => {};
  (dom.window.HTMLElement.prototype as any).detachEvent = () => {};
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); value = "";
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
describe("real table maths editor floating insertion", () => {
  it("fills the squared bracket rather than appending after it", async () => {
    await act(async () => root.render(<Editor insertion={{ nonce: 1, source: "(□)^{2}" }} />));
    await act(async () => root.render(<Editor insertion={{ nonce: 2, source: "-5" }} />));
    expect(value.replaceAll("−", "-")).toBe("(-5)^{2}");
  });
  it("does not replay the last chip after external undo", async () => {
    const insertion = { nonce: 1, source: "4" };
    await act(async () => root.render(<Editor insertion={insertion} />));
    expect(value).toBe("4");
    await act(async () => root.render(<Editor insertion={insertion} external="" />));
    expect(host.textContent).not.toContain("4");
  });
  it("keeps the mean symbol body on the baseline in reading and editing views", async () => {
    await act(async () => root.render(<span>{renderMathInline("x-\\bar{x}")}<MathCellEditor value={"\\bar{x}"} onChange={() => {}} onCommit={() => {}} /></span>));
    const accents = host.querySelectorAll<HTMLElement>('[data-math-kind="accent"]');
    expect(accents).toHaveLength(2);
    for (const accent of accents) {
      expect(accent.style.display).toBe("inline-block");
      expect(accent.style.verticalAlign).toBe("baseline");
      expect((accent.firstElementChild as HTMLElement).style.position).toBe("absolute");
      expect(accent.textContent).toContain("x");
    }
  });

});
