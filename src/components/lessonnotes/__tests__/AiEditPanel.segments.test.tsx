/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiEditPanel, type AiEditTarget } from "../AiEditPanel";

// The Radix progress bar hits a duplicate-React hook error under this jsdom
// setup (pre-existing; AiEditPanel.preserve.test.tsx fails the same way on a
// clean checkout). It is not under test here.
vi.mock("@/components/common/RebuildProgressBar", () => ({
  RebuildProgressBar: () => null,
}));

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

function setArea(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
const button = (label: string) =>
  [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;

const test25 = Array.from(
  { length: 25 },
  (_, i) => `${i + 1}. Solve x + ${i} = ${i + 5}`,
).join("\n");

describe("AI Edit split into segments", () => {
  it("puts Split beside Preserve/Generate, sends one short segment at a time and advances on Accept", async () => {
    const onGenerate = vi.fn(
      async (_i: string, t: AiEditTarget) =>
        `## Exercise\nProposed ${t.segment?.index}`,
    );
    const onApply = vi.fn(async () => true);
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <AiEditPanel
          open
          target={{ text: "", kind: "lesson_section", mode: "compose" }}
          onGenerate={onGenerate}
          onApply={onApply}
          onClose={onClose}
        />,
      );
    });
    const labels = [...host.querySelectorAll("button")].map(
      (b) => b.textContent?.trim() ?? "",
    );
    const splitAt = labels.findIndex((t) => t.includes("Split into segments"));
    const preserveAt = labels.findIndex((t) => t.includes("Preserve content"));
    expect(splitAt).toBeGreaterThan(-1);
    expect(preserveAt).toBe(splitAt + 1);

    await act(async () => setArea(host.querySelector("textarea")!, test25));
    await act(async () => {
      button("Split into segments")!.click();
    });

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const first = onGenerate.mock.calls[0][1];
    expect(first.segment).toMatchObject({
      index: 0,
      total: 3,
      firstQuestion: 1,
      lastQuestion: 10,
    });
    expect(first.text.split("\n")).toHaveLength(10);
    expect(first.text).not.toContain("11. Solve");
    expect(
      host.querySelector('[data-testid="segment-status"]')?.textContent,
    ).toContain("Segment 1 of 3");
    expect(host.textContent).toContain("Proposed 0");

    await act(async () => {
      button("Accept")!.click();
    });
    // Compose output is arranged into bold sessions before it is applied.
    expect(onApply).toHaveBeenCalledWith("**Exercise**\nProposed 0");
    expect(onClose).not.toHaveBeenCalled();
    expect(onGenerate).toHaveBeenCalledTimes(2);
    expect(onGenerate.mock.calls[1][1].text.startsWith("11. Solve")).toBe(true);
    expect(
      host.querySelector('[data-testid="segment-status"]')?.textContent,
    ).toContain("Segment 2 of 3");

    await act(async () => {
      button("Accept")!.click();
    });
    expect(onGenerate.mock.calls[2][1].segment).toMatchObject({
      index: 2,
      firstQuestion: 21,
      lastQuestion: 25,
    });
    expect(button("Accept")!.textContent).toContain("insert into note");
    await act(async () => {
      button("Accept")!.click();
    });
    expect(onApply).toHaveBeenCalledTimes(3);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("never shows the pasted script back as the proposal", async () => {
    const paste = "1. Solve 2x + 3 = 7\n2. Solve x - 4 = 1";
    const onGenerate = vi.fn(async () => paste);
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
    await act(async () => setArea(host.querySelector("textarea")!, paste));
    await act(async () => {
      button("Generate")!.click();
    });
    expect(host.textContent).not.toContain("Proposed");
    expect(host.textContent).toContain("only returned your script unchanged");
    expect(button("Accept")).toBeUndefined();
  });

  it("highlight mode shows the selection once, not again as Current", async () => {
    const onGenerate = vi.fn(async () => "3x = 9");
    await act(async () => {
      root.render(
        <AiEditPanel
          open
          target={{
            text: "2x + 1 = 5 plus a longer line here",
            kind: "equation",
          }}
          onGenerate={onGenerate}
          onApply={async () => true}
          onClose={() => {}}
        />,
      );
    });
    await act(async () => setArea(host.querySelector("textarea")!, "fix it"));
    await act(async () => {
      button("Generate")!.click();
    });
    expect(host.textContent).toContain("Proposed");
    expect(host.textContent).not.toContain("Current");
    expect(
      host.textContent?.split("2x + 1 = 5 plus a longer line here").length,
    ).toBe(2);
  });
});
