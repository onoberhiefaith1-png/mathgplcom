// @vitest-environment node
import { act, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureAttempt, recordMarks, type SessionAttempt, type SessionContext } from "@/lib/offline/evaluation";
import { EvaluationScreen } from "@/pages/academiaApp/AcademiaScreens";

const ownedDom = typeof document === "undefined"
  ? new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mathgpl.com/academia-app", pretendToBeVisual: true })
  : null;
if (ownedDom) {
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node"]) {
    Object.defineProperty(globalThis, name, { value: (ownedDom.window as unknown as Record<string, unknown>)[name], configurable: true, writable: true });
  }
}
const { createRoot } = await import("react-dom/client");
afterAll(() => ownedDom?.window.close());

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (node: ReactNode) => { await act(async () => root.render(node)); };

const ctx = (sessionId: string, tier: SessionContext["tier"], activityMax: Record<string, number>): SessionContext => ({
  sessionId, sessionTitle: sessionId, trail: "", schoolId: "s", classId: "c", subjectId: "m", subjectName: "Maths",
  topicId: "t", topicName: "Algebra", subtopicId: "u", subtopicName: "Linear", activityMax, tier,
});

function scored(id: string, tier: SessionContext["tier"], activityId: string, marks: number, max: number): SessionAttempt {
  const started = ensureAttempt([], ctx("session", tier, { [activityId]: max }), { now: "2026-11-01T00:00:00.000Z", id });
  return recordMarks(started.attempt, { eventId: "e", activityId, mode: "practice", marks, now: "2026-11-01T00:01:00.000Z" });
}

describe("Evaluation screen tiers", () => {
  const attempts = [
    scored("b", "beginner", "b", 3, 10),
    scored("i", "intermediate", "i", 4, 10),
    scored("e", "expert", "e", 7, 20),
  ];

  it("shows that tier's percentage and leaves the others untouched", async () => {
    await render(<EvaluationScreen attempts={attempts} view="beginner" />);
    expect(host.querySelector("[data-testid=eval-score]")?.getAttribute("data-percent")).toBe("30");
    expect(host.textContent).toContain("Beginner only");

    await render(<EvaluationScreen attempts={attempts} view="intermediate" />);
    expect(host.querySelector("[data-testid=eval-score]")?.getAttribute("data-percent")).toBe("40");

    await render(<EvaluationScreen attempts={attempts} view="expert" />);
    expect(host.querySelector("[data-testid=eval-score]")?.getAttribute("data-percent")).toBe("35");

    await render(<EvaluationScreen attempts={attempts} view="overall" />);
    expect(host.querySelector("[data-testid=eval-score]")?.getAttribute("data-percent")).toBe("35");
    expect(host.textContent).toContain("every mark earned divided by every mark possible");
  });

  it("says a tier with no attempts is not started", async () => {
    await render(<EvaluationScreen attempts={attempts.filter((a) => a.tier !== "expert")} view="expert" />);
    expect(host.querySelector("[data-testid=eval-empty]")?.textContent).toContain("Expert is not started yet");
  });
});
