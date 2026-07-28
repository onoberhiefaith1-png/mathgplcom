import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PresenterMath, toDisplaySafe } from "@/components/smartboard/PresenterMath";

const RAW = ["x_{1} = \\frac{-4}{2}", "\\sqrt{9} + x^{2}", "\\frac{-4}{2}"];

describe("Reasoning panel math rendering", () => {
  it("never paints raw LaTeX scaffolding as text", () => {
    for (const src of RAW) {
      const { container } = render(<PresenterMath ascii={toDisplaySafe(src)} />);
      const text = container.textContent ?? "";
      expect(text).not.toContain("\\frac");
      expect(text).not.toContain("\\sqrt");
      expect(text).not.toContain("^{");
      expect(text).not.toContain("_{");
    }
  });

  it("renders a fraction as a stacked structure, not a/b text", () => {
    const { container } = render(<PresenterMath ascii={toDisplaySafe("\\frac{-4}{2}")} />);
    expect(container.textContent).toContain("-4");
    expect(container.textContent).toContain("2");
    expect(container.querySelectorAll("span").length).toBeGreaterThan(1);
  });
});
