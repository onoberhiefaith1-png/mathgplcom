import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AppsDownloadPanels } from "@/components/site/DownloadAcademiaDialog";

let root: Root;
let host: HTMLElement;
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it("shows both apps side by side, each opening its own install page", async () => {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://mathgpl.com/welcome" });
  for (const k of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(k, (dom.window as never)[k]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<AppsDownloadPanels />); });
  const grid = host.querySelector('[data-testid="two-apps"]')!;
  expect(grid.className).toContain("md:grid-cols-2");
  expect([...grid.children].map((c) => c.getAttribute("data-app"))).toEqual(["mathemagine", "academia"]);
  expect(grid.children[0].querySelector("h2")?.textContent).toBe("Mathemagine");
  expect(grid.children[1].querySelector("h2")?.textContent).toBe("Academia");
  expect(grid.children[0].querySelector('img[src="/mathemagine-icon-192.png"]')).not.toBeNull();
  expect(grid.children[1].querySelector('img[src="/academia-icon-192.png"]')).not.toBeNull();
  // Plain links (full page load), so the install page's own head is what the browser reads.
  expect(grid.children[0].querySelector("a")?.getAttribute("href")).toBe("/install/mathemagine");
  expect(grid.children[1].querySelector("a")?.getAttribute("href")).toBe("/install/academia");
  // The shared page itself offers no copy link, so a copied link is never ambiguous.
  expect(host.textContent).not.toContain("Copy link");
  expect(host.querySelectorAll("a").length).toBe(2);
});
