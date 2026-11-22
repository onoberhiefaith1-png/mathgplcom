import { afterEach, describe, expect, it, vi } from "vitest";
import { lessonWorkflowCause, startLessonWorkflow } from "./lessonWorkflow";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("lesson workflow diagnostics", () => {
  it("identifies read denial, invalid session, and timeout without using messages", () => {
    expect(lessonWorkflowCause({ code: "42501" })).toBe("42501");
    expect(lessonWorkflowCause({ status: 401 })).toBe("http-401");
    expect(lessonWorkflowCause(Object.assign(new Error("private"), { name: "LessonActionTimeout" }))).toBe("timeout");
    expect(lessonWorkflowCause({ code: "private-text" })).toBe("unclassified");
  });

  it("records only known diagnostic fields", () => {
    vi.stubGlobal("window", {});
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    startLessonWorkflow("academia.submit", "school")({
      error: { code: "42501", message: "private notebook text", detail: "private ID" },
    });
    expect(log).toHaveBeenCalledWith("[lesson-workflow]", {
      operation: "academia.submit", context: "school", build: expect.any(String),
      durationMs: expect.any(Number), outcome: "failed", cause: "42501",
    });
  });
});
