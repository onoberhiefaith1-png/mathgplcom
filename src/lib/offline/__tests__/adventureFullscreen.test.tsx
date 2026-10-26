/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/components/academia/AcademiaAdventurePlayer", () => ({ default: (p: any) => <div data-testid="player" data-fill={String(Boolean(p.fillParent))} /> }));
vi.mock("./OfflineMcq", () => ({ default: () => null }));
vi.mock("@/pages/academiaApp/OfflineMcq", () => ({ default: () => null }));
vi.mock("@/components/assistant/TutorGuide", () => ({ default: () => null }));
vi.mock("@/components/smartboard/PresentationView", () => ({ default: () => null }));
vi.mock("@/pages/imagine/ImaginePlayPage", () => ({ default: () => null }));
vi.mock("@/components/smartboard/QuestionVideoPane", () => ({ default: () => null }));
import OfflineActivity from "@/pages/academiaApp/OfflineActivity";

let root: Root; let host: HTMLElement;
beforeEach(() => {
  const dom = new JSDOM("<body></body>", { url: "https://mathgpl.com/academia-app" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "localStorage"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it("gives an Adventure the whole screen: a fixed frame above the app, sized by its parent, with the device's safe areas kept clear", async () => {
  const activity = { id: "a", title: "A", adventure: { id: "adv", game: { id: "g" } } } as any;
  await act(async () => root.render(<OfflineActivity activity={activity} sessionId="s" mode="play" onFinish={vi.fn()} onBack={vi.fn()} />));
  const frame = host.querySelector('[data-testid="adventure-fullscreen"]') as HTMLElement;
  expect(frame.className).toContain("fixed");
  expect(frame.className).toContain("inset-0");
  expect(frame.className).toContain("z-[100]"); // above the app's tab bar (z-30)
  expect(frame.className).toContain("pb-[env(safe-area-inset-bottom)]");
  expect(frame.className).toContain("pt-[env(safe-area-inset-top)]");
  expect(host.querySelector('[data-testid="player"]')!.getAttribute("data-fill")).toBe("true");
});
