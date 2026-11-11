import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppInstallPage from "@/components/site/AppInstallPage";
import type { InstallApp } from "@/lib/install/appInstallPages";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130 Mobile/15E148 Safari/604.1";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130 Mobile";

let root: Root;
let host: HTMLElement;
let writeText: ReturnType<typeof vi.fn>;
const mount = async (app: InstallApp, agent: string, url = `https://mathgpl.com/install/${app}`) => {
  const dom = new JSDOM("<!doctype html><body></body>", { url });
  Object.defineProperty(dom.window.navigator, "userAgent", { value: agent, configurable: true });
  writeText = vi.fn(async () => undefined);
  Object.defineProperty(dom.window.navigator, "clipboard", { value: { writeText }, configurable: true });
  for (const k of ["window", "document", "navigator", "HTMLElement", "Node", "Event"]) vi.stubGlobal(k, (dom.window as never)[k]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<AppInstallPage app={app} />); await Promise.resolve(); });
  return dom;
};
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
const click = async (el: Element | undefined) => { await act(async () => { (el as HTMLElement).click(); await Promise.resolve(); await Promise.resolve(); }); };

afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

describe.each([["academia", "Academia"], ["mathemagine", "Mathemagine"]] as const)("%s install page", (app, name) => {
  it("is about this one app only, with Copy link and Download tabs", async () => {
    await mount(app, WINDOWS);
    expect(host.querySelector("h1")?.textContent).toBe(`Install ${name}`);
    expect(host.querySelector("[data-app]")?.getAttribute("data-app")).toBe(app);
    const other = name === "Academia" ? "Mathemagine" : "Academia";
    expect(host.textContent).not.toContain(other);
    expect([...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(["Copy link", "Download"]);
  });

  it("Copy link copies this page's own address", async () => {
    await mount(app, IPHONE, `https://mathgpl.com/install/${app}?from=welcome#top`);
    expect(host.querySelector('[data-testid="install-link"]')?.textContent).toBe(`https://mathgpl.com/install/${app}`);
    await click(host.querySelector('[data-testid="copy-link"]')!);
    expect(writeText).toHaveBeenCalledWith(`https://mathgpl.com/install/${app}`);
    expect(host.textContent).toContain("Link copied");
    expect(host.textContent).toContain(`opens this ${name} page only`);
  });

  it("shows the Safari Share → Add to Home Screen → Add taps on an iPhone, with no install button", async () => {
    await mount(app, IPHONE);
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain("iPhone");
    const steps = host.querySelector('[data-testid="safari-steps"]')!;
    expect(steps.textContent).toContain("Share");
    expect(steps.textContent).toContain("Add to Home Screen");
    expect(steps.textContent).toContain(`The name should say ${name}`);
    expect(button(`Install ${name}`)).toBeUndefined();
  });

  it("tells iPhone Chrome users to open the link in Safari", async () => {
    await mount(app, IPHONE_CHROME);
    expect(host.textContent).toContain("Open this link in Safari first");
    expect(host.querySelector('[data-testid="safari-steps"]')).toBeNull();
  });

  it("installs with the browser's own prompt on a computer", async () => {
    const dom = await mount(app, WINDOWS);
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain("Windows");
    expect(button(`Install ${name}`)!.disabled).toBe(true);
    const prompt = vi.fn(async () => undefined);
    await act(async () => {
      dom.window.dispatchEvent(Object.assign(new dom.window.Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) }));
    });
    expect(button(`Install ${name}`)!.disabled).toBe(false);
    await click(button(`Install ${name}`));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain(`Installing ${name}`);
  });

  it("Download has no iPhone tile and offers this app's install on Android", async () => {
    await mount(app, ANDROID);
    await click(button("Download"));
    const tiles = [...host.querySelectorAll("button[aria-pressed]")].map((b) => b.textContent);
    expect(tiles.some((t) => t?.includes("iPhone"))).toBe(false);
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain("Android");
    if (app === "academia") expect(host.querySelector('a[download="mathgpl-academia.apk"]')).not.toBeNull();
    else expect(button("Install Mathemagine")).toBeDefined();
  });
});

it("offers Academia's Windows and Mac installer files, never for Mathemagine", async () => {
  await mount("academia", WINDOWS);
  await click(button("Download"));
  expect(host.querySelector("a[download]")?.textContent).toContain("Download for Windows");
  await act(async () => root.unmount());
  await mount("mathemagine", WINDOWS);
  await click(button("Download"));
  expect(host.querySelector("a[download]")).toBeNull();
  expect(button("Install Mathemagine")).toBeDefined();
});
