/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdventureGameBoundary from "@/components/academia/AdventureGameBoundary";

let root: Root; let host: HTMLElement; let boom = true;
function Bomb() { if (boom) throw new Error("surface crashed"); return <div>Surface</div>; }
beforeEach(() => {
  const dom = new JSDOM("<body></body>", { url: "https://mathgpl.com/" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  boom = true;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("shows a retry/skip panel instead of a blank screen, and recovers on retry", async () => {
  const skip = vi.fn();
  await act(async () => root.render(<AdventureGameBoundary onSkip={skip}><Bomb /></AdventureGameBoundary>));
  expect(host.querySelector("[role=alert]")?.textContent).toContain("could not be shown");
  boom = false;
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Try again")!.click());
  expect(host.textContent).toContain("Surface");
});

it("lets the student skip the learning point", async () => {
  const skip = vi.fn();
  await act(async () => root.render(<AdventureGameBoundary onSkip={skip}><Bomb /></AdventureGameBoundary>));
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Skip"))!.click());
  expect(skip).toHaveBeenCalled();
});
