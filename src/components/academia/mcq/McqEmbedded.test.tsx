import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import McqExamPage from "@/pages/academia/mcq/McqExamPage";
import { scrollBoardHost } from "@/lib/smartboard/embeddedLayout";
import { useBoardScrollLock } from "@/hooks/useBoardScrollLock";
import SensorDPad from "@/components/smartboard/SensorDPad";

const state = vi.hoisted(() => ({ paper: null as any, save: vi.fn(), props: null as any }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.paper }) }));
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ paperId: "paper" }), useRouter: () => ({ history: { back: vi.fn() } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, variant, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/academia/mcq/McqText", () => ({ default: ({ text }: any) => <span>{text}</span> }));
vi.mock("@/lib/academia/mcq/api", () => ({ getPaper: vi.fn(), saveAttempt: state.save }));
vi.mock("@/lib/offline/academiaPack", () => ({ compileOfflineBoard: () => ({ boardSource: {}, notebookId: "notebook", assessmentId: "practice", boardQuestionId: "question" }) }));
vi.mock("@/lib/stability/interactionReset", () => ({ registerInteractionResetter: () => () => {} }));
vi.mock("@/components/smartboard/PresentationView", () => ({ default: (props: any) => {
  state.props = props;
  const [score, setScore] = useState(0);
  return <button onClick={() => setScore(score + 1)}>Practice score {score}</button>;
} }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  const dom = new JSDOM("<!doctype html><body></body>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.paper = { id: "paper", title: "Practice paper", questions: [{ n: 1, text: "Find x", answer: "B", options: [{ label: "A", text: "3" }, { label: "B", text: "5" }], solution: { lines: [] } }] };
  state.save.mockReset(); state.props = null;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function render(node = <McqExamPage />) { await act(async () => root.render(node)); }
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.trim() === text);
  expect(button, text).toBeTruthy(); await act(async () => button!.click());
}
it("keeps unlinked questions answerable without a Smartboard", async () => {
  state.paper.questions[0].solution = null; await render();
  expect(host.textContent).not.toContain("Solution");
  await click("B5"); await click("Submit paper");
  expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ answers: { 1: "B" }, correct: 1 }));
});
it("opens inline practice before the options and keeps the local marking contract", async () => {
  await render(); await click("Solution");
  expect(state.props).toMatchObject({ embedded: true, localMarking: true, testMode: true, role: "student" });
  const board = host.querySelector('[aria-label="Solution practice"]')!;
  const option = [...host.querySelectorAll("button")].find((b) => b.textContent === "A3")!;
  expect(board.compareDocumentPosition(option) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(host.textContent).not.toContain("Scroll page");
  await click("Hide solution"); expect(host.querySelector('[aria-label="Solution practice"]')).toBeNull();
});
it("practice scoring does not select or change the paper answer", async () => {
  await render(); await click("Solution"); await click("Practice score 0");
  expect(host.textContent).toContain("0 of 1 answered");
  await click("A3"); await click("Practice score 1"); await click("Submit paper");
  expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ answers: { 1: "A" }, correct: 0, incorrect: 1 }));
});
it("embedded scrolling targets the document; standalone scrolling targets the board", () => {
  const board = document.createElement("main");
  board.getBoundingClientRect = () => ({ top: 240 } as DOMRect);
  board.scrollTo = vi.fn(); window.scrollTo = vi.fn();
  Object.defineProperty(window, "scrollY", { value: 100 });
  scrollBoardHost(board, 80, true);
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 420, behavior: "smooth" });
  expect(board.scrollTo).not.toHaveBeenCalled();
  scrollBoardHost(board, 80, false);
  expect(board.scrollTo).toHaveBeenCalledWith({ top: 80, behavior: "smooth" });
});
it("only standalone touch mode locks page scrolling and restores original styles", async () => {
  function Harness({ locked }: { locked: boolean }) { useBoardScrollLock(locked); return null; }
  document.body.style.overflow = "auto";
  await render(<Harness locked={false} />);
  expect(document.body.style.overflow).toBe("auto");
  await render(<Harness locked />); expect(document.body.style.overflow).toBe("hidden");
  await render(<Harness locked={false} />);
  expect(document.body.style.overflow).toBe("auto");
  expect(document.documentElement.style.height).toBe("");
});
it("inline sensor keys preserve press-and-hold and stop repeating on release", async () => {
  vi.useFakeTimers();
  const right = vi.fn();
  await render(<SensorDPad inline onUp={vi.fn()} onDown={vi.fn()} onLeft={vi.fn()} onRight={right} canLeft={false} chromeBg="white" chromeFg="black" chromeBorder="grey" />);
  expect(host.querySelector('[aria-label="Sensor left"]')?.hasAttribute("disabled")).toBe(true);
  const button = host.querySelector('[aria-label="Sensor right"]')!;
  await act(async () => button.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })));
  expect(right).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(600));
  expect(right.mock.calls.length).toBeGreaterThan(1);
  await act(async () => button.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true })));
  const calls = right.mock.calls.length;
  await act(async () => vi.advanceTimersByTime(600));
  expect(right).toHaveBeenCalledTimes(calls);
});

it("uses the downloaded paper and device save adapter without account persistence", async () => {
  const save = vi.fn();
  const back = vi.fn();
  const paper = { ...state.paper, title: "Downloaded Algebra" };
  state.paper = undefined;
  await render(<McqExamPage offline={{ paper, save, onBack: back }} />);
  expect(host.textContent).toContain("Downloaded Algebra");
  await click("Solution"); await click("Practice score 0");
  expect(host.textContent).toContain("0 of 1 answered");
  await click("B5"); await click("Submit paper");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ correct: 1, answers: { 1: "B" } }));
  expect(state.save).not.toHaveBeenCalled();
});
