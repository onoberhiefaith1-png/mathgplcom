import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InlineMcqPractice } from "./InlineMcqPractice";
vi.mock("./McqText", () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
const question = { text: "Constant term in 4x + 7?", options: [{ label: "A", text: "−7" }, { label: "B", text: "7" }], answer: "B" };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  const dom = new JSDOM("<!doctype html><body></body>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "MouseEvent"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const click = async (text: string) => {
  const button = [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === text)!;
  expect(button).toBeTruthy(); await act(async () => button.click());
};
it("marks only on Next, reveals on request, and resets feedback for retry", async () => {
  const check = vi.fn(async (label: string) => label === "B"), input = vi.fn();
  await act(async () => root.render(<InlineMcqPractice question={question} onCheck={check} onInput={input} />));
  await click("A−7"); expect(check).not.toHaveBeenCalled(); expect(input).toHaveBeenCalledTimes(1);
  await click("Next"); expect(check).toHaveBeenCalledWith("A");
  expect(host.textContent).toContain("Not correct"); expect(host.textContent).not.toContain("Correct answer:");
  await click("Show correct answer"); expect(host.textContent).toContain("Correct answer: B");
  await click("Try again"); expect(host.querySelector('[role="status"]')).toBeNull();
  await click("B7"); await click("Next"); expect(host.querySelector('[role="status"]')?.textContent).toContain("Correct");
});
it("shows a retryable connection error rather than an incorrect verdict", async () => {
  await act(async () => root.render(<InlineMcqPractice question={question} onCheck={async () => { throw new Error("offline"); }} onInput={() => {}} />));
  await click("B7"); await click("Next");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not check");
  expect(host.querySelector('[role="status"]')).toBeNull();
});
it("keeps teacher preview read-only", async () => {
  const check = vi.fn(); await act(async () => root.render(<InlineMcqPractice question={question} onCheck={check} onInput={() => {}} readOnly />));
  expect([...host.querySelectorAll('[role="radio"]')].every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  expect(host.textContent).not.toContain("Next"); expect(check).not.toHaveBeenCalled();
});
