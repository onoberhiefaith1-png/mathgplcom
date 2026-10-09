// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { MathTreeRender } from "../MathTreeRender";
import { mkChar, mkFrac } from "@/lib/smartboard/mathTree";

const placeholders = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-placeholder-source='math-tree'], [data-sb-placeholder]"));

describe("Game surface placeholder taps", () => {
  it("a tap on the denominator placeholder puts the sensor inside it", () => {
    const onCursorChange = vi.fn();
    const { container } = render(
      <MathTreeRender
        root={[mkChar("3"), mkFrac()]}
        cursor={{ path: [], index: 2 }}
        onCursorChange={onCursorChange}
        caretColor="black"
        readOnly
        interactiveCaret
        showReadOnlyCaret
      />,
    );
    const slots = placeholders(container);
    expect(slots.length).toBe(2);
    fireEvent.pointerDown(slots[1]);
    expect(onCursorChange).toHaveBeenLastCalledWith({ path: [1, 1], index: 0 });
  });

  it("a plain read-only mirror still ignores taps", () => {
    const onCursorChange = vi.fn();
    const { container } = render(
      <MathTreeRender root={[mkFrac()]} cursor={{ path: [], index: 0 }} onCursorChange={onCursorChange} caretColor="black" readOnly />,
    );
    const slots = placeholders(container);
    if (slots[0]) fireEvent.pointerDown(slots[0]);
    expect(onCursorChange).not.toHaveBeenCalled();
  });
});
