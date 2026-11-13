import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ record: vi.fn(async () => {}), navigate: vi.fn() }));
vi.mock("@/lib/academia/activityChain", () => ({ activityHref: async () => "/next-practice", activityNeighbours: vi.fn() }));
vi.mock("@/lib/academia/api", () => ({ loadActivity: vi.fn(), recordActivityResult: state.record }));
vi.mock("@/lib/academia/mcq/api", () => ({ getPaper: vi.fn(), listSessionItems: vi.fn() }));
vi.mock("@/lib/router-compat", () => ({ useParams: () => ({ activityId: "mcq" }), useNavigate: () => state.navigate,
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("lucide-react", () => ({ ArrowLeft: () => null, ChevronLeft: () => null, ChevronRight: () => null,
  Loader2: () => null, PenLine: () => null, RotateCcw: () => null, Trophy: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: ({ asChild, children, ...props }: any) => asChild ? children : <button {...props}>{children}</button> }));
vi.mock("@/components/academia/mcq/McqText", () => ({ default: ({ text }: any) => <span>{text}</span> }));
vi.mock("@/components/academia/mcq/McqSolutionBoard", () => ({ default: () => <div>Floating solution</div> }));
vi.mock("@tanstack/react-query", () => ({ useQuery: ({ queryKey }: any) => {
  const data = queryKey[0] === "mcq-activity" ? { id: "mcq", session_id: "session", ref_id: "paper", kind: "mcq", title: "Constant term", tier: "beginner" }
    : queryKey[0] === "mcq-items" ? [{ n: 17, text: "Constant term in 4x + 7?", options: [{ label: "A", text: "−7" }, { label: "B", text: "7" }], answer: "B" }]
    : queryKey[0] === "mcq-paper" ? { questions: [{ n: 17, solution: { lines: [] } }] }
    : { prev: { id: "previous" }, next: { id: "next" }, index: 5, total: 10 };
  return { data, isLoading: false };
} }));
import SessionMcqPage from "@/pages/academia/mcq/SessionMcqPage";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  const dom = new JSDOM("<!doctype html><body></body>");
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "MouseEvent"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  state.record.mockClear(); state.navigate.mockClear();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const click = async (text: string) => {
  const button = [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === text)!;
  expect(button).toBeTruthy(); await act(async () => button.click());
};
it("marks a correct choice, reviews it immediately, and can retry with Practice navigation intact", async () => {
  await act(async () => root.render(<SessionMcqPage />));
  expect(host.textContent).toContain("Question 6");
  expect(host.textContent).not.toContain("Question 17");
  expect(host.textContent).not.toContain("6/10");
  expect(host.textContent).not.toContain("Solution");
  await click("B7"); expect(state.record).not.toHaveBeenCalled();
  await click("Finish & mark");
  expect(host.textContent).toContain("Marked!"); expect(host.textContent).toContain("100%");
  expect(host.textContent).toContain("Correct");
  expect(state.record).toHaveBeenCalledWith(expect.objectContaining({ id: "mcq" }), 1, 1);
  expect(host.textContent).toContain("Previous practice"); expect(host.textContent).toContain("Next practice");
  await click("Go again"); expect(host.textContent).not.toContain("Marked!");
  expect(host.textContent).toContain("Finish & mark");
  await click("Next practice"); expect(state.navigate).toHaveBeenCalledWith("/next-practice");
});
it("shows the wrong selection and the correct option as soon as it is marked", async () => {
  await act(async () => root.render(<SessionMcqPage />));
  await click("A−7"); await click("Finish & mark");
  expect(host.textContent).toContain("0%");
  expect(host.textContent).toContain("Your answer"); expect(host.textContent).toContain("Correct");
  expect(state.record).toHaveBeenCalledWith(expect.objectContaining({ id: "mcq" }), 0, 1);
});
