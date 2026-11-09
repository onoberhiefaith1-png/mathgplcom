import { describe, expect, it, vi } from "vitest";
import { focusWithoutScroll } from "../focusWithoutScroll";

describe("focusWithoutScroll", () => {
  it("focuses with preventScroll so a hidden input cannot jump the board", () => {
    const focus = vi.fn();
    focusWithoutScroll({ focus } as unknown as HTMLElement);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it("does nothing when the element is missing", () => {
    expect(() => focusWithoutScroll(null)).not.toThrow();
  });
});
