import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import McqText from "./McqText";
vi.mock("@/lib/notebook/mathRender", () => ({ renderMathInline: (text: string) => text }));
it("keeps open/closed number-line points and aligned endpoint labels", async () => {
  const dom = new JSDOM("<!doctype html><body></body>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    const diagram = "←────●═══════════════════○────→\n    −2                   3";
    await act(async () => root.render(<McqText text={diagram} k="optionB" />));
    const rows = [...host.querySelectorAll("span")];
    expect(rows.map(row => row.textContent).join("\n")).toBe(diagram);
    expect(rows.every(row => row.classList.contains("whitespace-pre"))).toBe(true);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
