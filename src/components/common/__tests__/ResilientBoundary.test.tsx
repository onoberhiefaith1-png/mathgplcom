// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/lovable-error-reporting", () => ({ reportLovableError: vi.fn() }));
import { ResilientBoundary } from "@/components/common/ResilientBoundary";
import { readClientErrors, CLIENT_ERRORS_KEY } from "@/lib/diagnostics/clientErrors";

let root: Root;
let host: HTMLElement;
const crash = { left: 0 };
function Flaky() {
  if (crash.left > 0) { crash.left--; throw new Error("board exploded"); }
  return <p data-testid="board">board</p>;
}
const fallback = ({ recovering, retry }: { recovering: boolean; retry: () => void }) =>
  recovering ? <p data-testid="recovering">Reloading…</p> : <button data-testid="retry" onClick={retry}>Reload board</button>;
const byTest = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.removeItem(CLIENT_ERRORS_KEY);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a crash in one part of the class page", () => {
  it("keeps the rest of the page and brings that part back by itself", async () => {
    crash.left = 1000;
    act(() => root.render(<div><ResilientBoundary name="smartboard-board" fallback={fallback}><Flaky /></ResilientBoundary><p data-testid="audio">audio</p></div>));
    expect(byTest("recovering")).not.toBeNull();
    expect(byTest("audio")).not.toBeNull();
    crash.left = 0;
    await act(async () => { vi.advanceTimersByTime(1600); });
    expect(byTest("board")).not.toBeNull();
    expect(readClientErrors()[0]).toMatchObject({ where: "smartboard-board" });
    expect(readClientErrors()[0]!.message).toContain("board exploded");
  });
  it("stops retrying after a few crashes a minute and offers a button", async () => {
    crash.left = 1000;
    act(() => root.render(<ResilientBoundary name="b" fallback={fallback} maxAutoRetries={2}><Flaky /></ResilientBoundary>));
    for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1600); });
    expect(byTest("retry")).not.toBeNull();
    crash.left = 0;
    await act(async () => { byTest("retry")!.click(); });
    expect(byTest("board")).not.toBeNull();
  });
});
