/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiEditPanel } from "../AiEditPanel";
import { MIXED_MCQ_GUIDANCE } from "@/lib/lessonnotes/inlineMcq";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function buttonLabels() {
  return [...host.querySelectorAll("button")].map((b) => b.textContent?.replace(/\s+/g, " ").trim() ?? "");
}

function setArea(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AI Edit preserve content", () => {
  it("places Preserve content beside Generate and sends a faithful rewrite", async () => {
    const onGenerate = vi.fn(async () => "Exercise 1\nSolve 2x + 3 = 7");
    await act(async () => {
      root.render(
        <AiEditPanel
          open
          target={{ text: "", kind: "lesson_section", mode: "compose" }}
          onGenerate={onGenerate}
          onApply={async () => true}
          onClose={() => {}}
        />,
      );
    });

    const labels = buttonLabels();
    const preserveAt = labels.findIndex((t) => t.includes("Preserve content"));
    const generateAt = labels.findIndex((t) => t.endsWith("Generate"));
    expect(preserveAt).toBeGreaterThan(-1);
    expect(generateAt).toBe(preserveAt + 1);

    const paste = host.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => setArea(paste, "1. Solve 2x + 3 = 7\nx = 2"));
    const preserve = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Preserve content"));
    await act(async () => { preserve?.click(); });

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect((onGenerate.mock.calls as unknown as any[][])[0]![0]).toBe("");
    expect((onGenerate.mock.calls as unknown as any[][])[0]![1]).toMatchObject({
      preserve: true,
      mode: "compose",
      text: "1. Solve 2x + 3 = 7\nx = 2",
    });
  });

  it("keeps Generate on the upscale path", async () => {
    const onGenerate = vi.fn(async () => "worked");
    await act(async () => {
      root.render(
        <AiEditPanel
          open
          target={{ text: "", kind: "lesson_section", mode: "compose" }}
          onGenerate={onGenerate}
          onApply={async () => true}
          onClose={() => {}}
        />,
      );
    });
    const paste = host.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => setArea(paste, "1. Solve x + 1 = 4"));
    const generate = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().endsWith("Generate"));
    await act(async () => { generate?.click(); });
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect((onGenerate.mock.calls as unknown as any[][])[0]![1].preserve).toBeUndefined();
  });

  it("asks for a paste before preserving and stays off selection edit", async () => {
    const onGenerate = vi.fn(async () => "unused");
    await act(async () => {
      root.render(
        <AiEditPanel
          open
          target={{ text: "", kind: "lesson_section", mode: "compose" }}
          onGenerate={onGenerate}
          onApply={async () => true}
          onClose={() => {}}
        />,
      );
    });
    const preserve = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Preserve content"));
    await act(async () => { preserve?.click(); });
    expect(onGenerate).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Paste the lesson or solutions you want preserved.");

    await act(async () => {
      root.render(
        <AiEditPanel
          open
          target={{ text: "2x + 1 = 5", kind: "equation" }}
          onGenerate={onGenerate}
          onApply={async () => true}
          onClose={() => {}}
        />,
      );
    });
    expect(buttonLabels().some((t) => t.includes("Preserve content"))).toBe(false);
    expect(buttonLabels().some((t) => t.endsWith("Generate"))).toBe(true);
    expect(host.querySelector("[data-testid='selection-ai-actions']")).toBeTruthy();
  });

  it("runs a one-step action on the highlighted text only", async () => {
    const onGenerate = vi.fn(async () => "Question 8\nPick one.\nA. Yes\nB. No\nCorrect Answer: B");
    const highlighted = 'Does "the nicest colours" define a set?\nA. Yes\nB. No\nCorrect Answer: B\nExplanation: A set must be well-defined.';
    await act(async () => {
      root.render(
        <AiEditPanel
          open
          target={{ text: highlighted, kind: "paragraph" }}
          onGenerate={onGenerate}
          onApply={async () => true}
          onClose={() => {}}
        />,
      );
    });
    expect(host.textContent).toContain(highlighted.split("\n")[0]);
    const convert = host.querySelector("[data-testid='ai-edit-action-mcq']") as HTMLButtonElement;
    expect(convert?.textContent).toContain("Convert to MCQ");
    await act(async () => { convert.click(); });
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const [instruction, target] = (onGenerate.mock.calls as unknown as any[][])[0]!;
    expect(instruction).toContain("multiple-choice question");
    expect(instruction).toContain(MIXED_MCQ_GUIDANCE);
    expect(target.text).toBe(highlighted);
    expect(target.mode).toBeUndefined();
  });
});
