import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupDom } from "@/test/domRender";

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(async () => []) }));
vi.mock("@/lib/assessments/studentQuestions.functions", () => ({ askAssessmentQuestion: {}, listMyAssessmentQuestions: {} }));

import AskAssessmentQuestion, { ASK_TEACHER_LABEL } from "../AskAssessmentQuestion";

let dom: ReturnType<typeof setupDom>;
beforeEach(() => { dom = setupDom(); });
afterEach(async () => { await dom.cleanup(); });

const mount = () => dom.render(
  <QueryClientProvider client={new QueryClient()}>
    <AskAssessmentQuestion assessmentId="a" classId="c" />
  </QueryClientProvider>,
);

describe("Ask your teacher — icon only", () => {
  it("shows a question-mark icon with an accessible name, tooltip title and no persistent text", async () => {
    await mount();
    const button = dom.host.querySelector<HTMLButtonElement>('[data-testid="ask-teacher-question"]')!;
    expect(button.getAttribute("aria-label")).toBe(ASK_TEACHER_LABEL);
    expect(button.getAttribute("title")).toBe(ASK_TEACHER_LABEL);
    expect(button.textContent?.trim()).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(dom.host.textContent).not.toContain(ASK_TEACHER_LABEL);
  });
  it("still opens the question panel", async () => {
    await mount();
    const button = dom.host.querySelector<HTMLButtonElement>('[data-testid="ask-teacher-question"]')!;
    await act(async () => { button.click(); });
    expect(dom.host.textContent).toContain("Ask a Question");
  });
});
