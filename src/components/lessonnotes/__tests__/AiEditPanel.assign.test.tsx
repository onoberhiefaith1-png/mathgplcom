/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AiEditPanel } from "../AiEditPanel";

it("uses local Assign repair for an existing selection and falls back to AI only for conversion", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const generate = vi.fn(async () => "Which number is even?\nA. 1\nB. 2\nC. 3\nCorrect answer: B");
  const repair = vi.fn((action) => action === "mcq" || action === "fix");
  try {
    await act(async () => {
      root.render(<AiEditPanel open target={{ text: "Selected question", kind: "lesson_section" }}
        onSelectionAction={repair} onGenerate={generate} onApply={() => true} onClose={() => {}} />);
    });
    await act(async () => { host.querySelector<HTMLButtonElement>('[data-testid="ai-edit-action-mcq"]')?.click(); });
    await act(async () => { host.querySelector<HTMLButtonElement>('[data-testid="ai-edit-action-fix"]')?.click(); });
    expect(repair.mock.calls.map(([action]) => action)).toEqual(["mcq", "fix"]);
    expect(generate).not.toHaveBeenCalled();
    repair.mockReturnValue(false);
    await act(async () => { host.querySelector<HTMLButtonElement>('[data-testid="ai-edit-action-mcq"]')?.click(); });
    expect(generate).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
