// A fraction chip is ONE object with TWO cells. Brace-stripping in the
// Unicode normaliser used to dissolve `\frac{□}{□}` into `\frac□□`, which the
// renderer drew as an empty fraction plus two orphan boxes — four cells.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { toUnicodeMath } from "@/lib/notebook/unicodeMath";
import { renderMathInline } from "@/lib/notebook/mathRender";

const slots = (markup: string) => {
  const { container } = render(<div>{renderMathInline(markup, "t")}</div>);
  return container.querySelectorAll("[data-sb-placeholder]").length;
};

describe("floating chip placeholders", () => {
  it("keeps the fraction braces through normalisation", () => {
    expect(toUnicodeMath("x=\\frac{□}{□}")).toContain("\\frac{□}{□}");
  });

  it("renders exactly two slots for an empty fraction chip", () => {
    expect(slots(toUnicodeMath("x=\\frac{□}{□}"))).toBe(2);
  });

  it("renders two slots even if the braces were already stripped", () => {
    expect(slots("x=\\frac□□")).toBe(2);
  });

  it("does not regress radicals", () => {
    expect(slots(toUnicodeMath("\\sqrt{□}"))).toBe(1);
  });
});
