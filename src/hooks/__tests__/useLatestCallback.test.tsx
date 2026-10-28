import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";
import { useLatestCallback } from "../useLatestCallback";
it("an editor extension retaining its initial handler calls the current ready editor and lesson", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); const root = createRoot(host);
  let retained: ((instruction: string) => string) | undefined;
  function Harness({ editor }: { editor: string | null }) {
    const handler = useLatestCallback((instruction: string) => `${editor ?? "not ready"}:${instruction}`);
    retained ??= handler;
    return null;
  }
  try {
    await act(async () => root.render(<Harness editor={null} />));
    const original = retained;
    await act(async () => root.render(<Harness editor="ready lesson" />));
    expect(retained).toBe(original);
    expect(retained!("generate solution")).toBe("ready lesson:generate solution");
    await act(async () => root.render(<Harness editor="next subtopic" />));
    expect(retained!("generate question")).toBe("next subtopic:generate question");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
