import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { predictedLineDisplay } from "../predictedDisplay";
import { PresenterMath, toDisplaySafe } from "@/components/smartboard/PresenterMath";

const html = (ascii: string) => renderToStaticMarkup(<PresenterMath ascii={ascii} />);

describe("predicted line renders the expected line's structure", () => {
  it("2^5 = 2×2×2×2×2 as a real superscript, not caret text", () => {
    const shown = html(predictedLineDisplay("(2)^(5) = 2 × 2 × 2 × 2 × 2"));
    expect(shown).toContain('data-math-kind="superscript"');
    const visible = shown.replace(/<[^>]*>/g, "");
    expect(visible).not.toContain("^");
    expect(visible).not.toContain("(2)");
    // identical structure to the expected line's own rendering
    expect(shown.match(/superscript/g)?.length).toBe(html("2^{5} = 2 × 2 × 2 × 2 × 2").match(/superscript/g)?.length);
  });
  it("fractions and roots stay structured", () => {
    expect(html(predictedLineDisplay("(a + 1)/(b) = c"))).toMatch(/frac|fraction/);
    expect(html(predictedLineDisplay("x = sqrt(b^(2) - 4ac)"))).toContain('data-math-kind="radical"');
  });
  it("brackets the student wrote are kept", () => {
    expect(predictedLineDisplay("2(x + 1) = 4")).toBe("2(x + 1) = 4");
    expect(predictedLineDisplay("(x + 1)^(2)")).toBe("(x + 1)^{2}");
  });
  it("old path showed raw caret text (regression)", () => {
    expect(html(toDisplaySafe("(2)^(5)")).replace(/<[^>]*>/g, "")).toContain("^");
  });
  it("both evaluation panels render predictions through predictedLineDisplay", () => {
    for (const f of ["components/smartboard/TeacherEvaluationPanel.tsx", "components/gameslate/GameEvaluationPanel.tsx"]) {
      const src = readFileSync(resolve(__dirname, "../../..", f), "utf8");
      expect(src).toContain("predictedLineDisplay(");
    }
  });
});
