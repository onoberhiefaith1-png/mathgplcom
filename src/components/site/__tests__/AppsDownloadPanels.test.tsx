import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppsDownloadPanels } from "@/components/site/DownloadAcademiaDialog";
import { __setDeferredInstallForTest } from "@/lib/install/mathemagineApp";

let root: Root;
let host: HTMLElement;
const ua = (agent: string) => {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://mathgpl.com/" });
  Object.defineProperty(dom.window.navigator, "userAgent", { value: agent, configurable: true });
  (dom.window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const k of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(k, (dom.window as never)[k]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
};
const mount = async () => { await act(async () => { root.render(<AppsDownloadPanels />); await Promise.resolve(); }); };

beforeEach(() => { __setDeferredInstallForTest(null); });
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); __setDeferredInstallForTest(null); });

it("shows two apps side by side: Mathemagine on the left, Academia on the right", async () => {
  ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130");
  await mount();
  const grid = host.querySelector('[data-testid="two-apps"]')!;
  expect(grid.className).toContain("md:grid-cols-2");
  expect([...grid.children].map((c) => c.getAttribute("data-app"))).toEqual(["mathemagine", "academia"]);
  expect(grid.children[0].querySelector("h2")?.textContent).toBe("Mathemagine");
  expect(grid.children[1].querySelector("h2")?.textContent).toBe("Academia");
  expect(grid.children[1].textContent).toContain("Copy to phone");
  expect(grid.children[1].querySelector('img[src="/academia-icon-192.png"]')).not.toBeNull();
  expect(grid.children[0].querySelector('img[src="/mathemagine-icon-192.png"]')).not.toBeNull();
});

it("installs Mathemagine with the browser prompt on a computer", async () => {
  ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130");
  const prompt = vi.fn(async () => undefined);
  __setDeferredInstallForTest(Object.assign(new Event("beforeinstallprompt"), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) }));
  await mount();
  const left = host.querySelector('[data-app="mathemagine"]')!;
  expect(left.querySelector('button[aria-pressed="true"]')?.textContent).toContain("Windows");
  const install = [...left.querySelectorAll("button")].find((b) => b.textContent?.includes("Install Mathemagine"))!;
  expect(install.disabled).toBe(false);
  await act(async () => { install.click(); await Promise.resolve(); await Promise.resolve(); });
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(left.textContent).toContain("Installing Mathemagine");
});

it("shows Add to Home Screen steps on an iPhone, with no install button", async () => {
  ua("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
  await mount();
  const left = host.querySelector('[data-app="mathemagine"]')!;
  expect(left.querySelector('button[aria-pressed="true"]')?.textContent).toContain("iPhone");
  expect(left.textContent).toContain("Add to Home Screen");
  expect([...left.querySelectorAll("button")].some((b) => b.textContent?.includes("Install Mathemagine"))).toBe(false);
});

it("answers the first tap on a device tile", async () => {
  ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130");
  await mount();
  const left = host.querySelector('[data-app="mathemagine"]')!;
  const android = [...left.querySelectorAll("button")].find((b) => b.textContent?.includes("Android"))!;
  await act(async () => { android.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  expect(android.getAttribute("aria-pressed")).toBe("true");
  expect(left.textContent).toContain("Open mathgpl.com in Chrome.");
});
