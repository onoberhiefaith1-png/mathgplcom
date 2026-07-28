import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MathInlineCanvas } from "@/components/lessonnotes/extensions/MathInlineCanvas";
import { latexToTree } from "@/lib/smartboard/mathTreeLatex";

const renderMath = (latex: string, focused = false) => render(
  <MathInlineCanvas
    root={latexToTree(latex)}
    onChange={vi.fn()}
    onBlur={vi.fn()}
    focused={focused}
    onFocus={vi.fn()}
  />,
);

describe("MathInlineCanvas compact script rendering", () => {
  it("renders a simple exponent without an empty lower slot", () => {
    const { container } = renderMath("x^{2}");
    expect(container.textContent).toContain("x2");
    expect(container.querySelector('[data-math-empty-slot="true"]')).toBeNull();
  });

  it("renders a simple subscript without an empty upper slot", () => {
    const { container } = renderMath("x_{2}");
    expect(container.textContent).toContain("x2");
    expect(container.querySelector('[data-math-empty-slot="true"]')).toBeNull();
  });

  it("keeps combined subscript and exponent visible", () => {
    const { container } = renderMath("x_{2}^{3}");
    expect(container.textContent).toContain("x");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("3");
    expect(container.querySelector('[data-math-empty-slot="true"]')).toBeNull();
  });

  it("keeps nested exponents lossless and free of phantom slots", () => {
    const { container } = renderMath("x^{2^{5^{n}}}");
    expect(container.textContent).toContain("x");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("n");
    expect(container.querySelector('[data-math-empty-slot="true"]')).toBeNull();
  });
});