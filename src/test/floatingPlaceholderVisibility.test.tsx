// Placeholders are mathematical information — an empty slot must ALWAYS be
// visible. The floating chip bar is white, so painting slots with the board's
// near-white cream placeholder colour made every placeholder look deleted
// (√□, □^□, the fraction cells). Only the FOUR-cell fraction was ever wrong;
// the correct shape is one slot per real cell.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import {
  PLACEHOLDER_COLOR,
  LIGHT_SURFACE_PLACEHOLDER_COLOR,
  visiblePlaceholderColor,
} from "@/lib/smartboard/placeholderColor";

const slots = (markup: string, color?: string) => {
  const { container } = render(
    <div>{renderMathInline(markup, "t", { placeholderColor: color })}</div>,
  );
  return Array.from(container.querySelectorAll<HTMLElement>("[data-sb-placeholder]"));
};

describe("floating placeholder visibility", () => {
  it("swaps a cream slot for a visible grey one on a white chip bar", () => {
    expect(visiblePlaceholderColor(PLACEHOLDER_COLOR, "#ffffff")).toBe(
      LIGHT_SURFACE_PLACEHOLDER_COLOR,
    );
  });

  it("keeps a colour that already contrasts with the surface", () => {
    expect(visiblePlaceholderColor("#1a2230", "#ffffff")).toBe("#1a2230");
  });

  it("keeps placeholders on every structure chip", () => {
    expect(slots("±\\sqrt{□}").length).toBe(1);
    expect(slots("□^{□}").length).toBe(2);
    expect(slots("(□)").length).toBe(1);
    expect(slots("□").length).toBe(1);
    expect(slots("log_{□}(□)").length).toBe(2);
  });

  it("draws exactly two cells for a fraction chip — never four", () => {
    expect(slots("x=\\frac{□}{□}").length).toBe(2);
    expect(slots("x=\\frac□□").length).toBe(2);
  });

  it("paints the slot with the requested visible colour", () => {
    const [slot] = slots("\\sqrt{□}", LIGHT_SURFACE_PLACEHOLDER_COLOR);
    expect(slot.style.background.toLowerCase()).toContain("154, 163, 175");
  });
});
