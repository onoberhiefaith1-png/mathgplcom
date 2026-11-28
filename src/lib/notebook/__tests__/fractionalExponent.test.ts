import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EquationAtoms from "@/components/floating/EquationAtoms";
import { parseAtoms } from "@/lib/floating/atoms";
import { normaliseExponentSyntax, readableMathFallback } from "@/lib/notebook/exponentForm";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import { isStillDirty } from "@/lib/notebook/unicodeMath";
import { tokensFromEquation } from "@/lib/lessonnotes/floatingCompile";
import { extractLine } from "../../../../supabase/functions/notebook-ai/floatingExtractor";
import { extractTermsFromAscii } from "@/lib/smartboard/floatingExtractor";

const textOf = (node: React.ReactNode) =>
  renderToStaticMarkup(createElement("span", null, node)).replace(/<[^>]+>/g, "");

const shownLine = (equation: string) => textOf(createElement(EquationAtoms, {
  equation,
  lineId: "direct-variation",
  chips: [],
  onApply: () => {},
}));

/** The orange game tile: display-gate then the chip renderer. */
const tileHtml = (label: string) => renderToStaticMarkup(createElement("span", null,
  renderMathInline(assertDisplaySafe(label).cleaned, "tile", { alignMath: "center", nowrap: true })));

const shownChips = (equation: string) => extractLine(equation).fillers.map((chip) => ({
  chip,
  html: tileHtml(chip),
  shown: textOf(renderMathInline(chip, "chip", { alignMath: "center", nowrap: true })),
}));

/** A power tile keeps the base and the fractional exponent in one superscript. */
const isPowerTile = (html: string, base: string) => {
  const sups = html.match(/<sup\b[^>]*data-math-kind="superscript"[^>]*>[\s\S]*?<\/sup>/g) ?? [];
  const fractionSup = sups.find((sup) => sup.includes('data-math-kind="fraction"') && sup.includes("vertical-align:super"));
  return !!fractionSup && html.includes(base);
};

const DIRECT = [
  String.raw`y = \frac{3}{\sqrt{2}} \times \sqrt{50}^{\frac{3}{2}}`,
  String.raw`y = \frac{3}{\sqrt{2}} \times (50^{\frac{3}{2}})^{\frac{1}{2}}`,
  String.raw`y = \frac{3}{\sqrt{2}} \times 50^{\frac{3}{4}}`,
  String.raw`50^{\frac{3}{4}} = (2 \times 5^{2})^{\frac{3}{4}}`,
];

describe("fractional exponents never reach the lesson as raw markup", () => {
  it("normalises every incoming exponent form into a braced superscript fraction", () => {
    expect(normaliseExponentSyntax(String.raw`\sqrt{50}^\frac{3}{2}`)).toBe(String.raw`\sqrt{50}^{\frac{3}{2}}`);
    expect(normaliseExponentSyntax("50^{3/2}")).toBe(String.raw`50^{\frac{3}{2}}`);
    expect(normaliseExponentSyntax("50^(3/2)")).toBe(String.raw`50^{\frac{3}{2}}`);
    expect(normaliseExponentSyntax(String.raw`(50^{\frac{3}{2}})^{\frac12}`)).toBe(String.raw`(50^{\frac{3}{2}})^{\frac{1}{2}}`);
    expect(normaliseExponentSyntax(String.raw`50^{\frac{3}{2}}`)).toBe(String.raw`50^{\frac{3}{2}}`);
  });

  it("falls back to readable plain math when a superscript fraction cannot be drawn", () => {
    expect(readableMathFallback(String.raw`50^{\frac{3}{2}}`)).toBe("50^(3/2)");
  });

  it.each(DIRECT)("draws %s with a real superscript and no raw command", (equation) => {
    const shown = shownLine(equation);
    expect(shown).not.toMatch(/\\/);
    expect(shown).not.toContain("frac");
    expect(parseAtoms(equation, "L").every((atom) => !atom.value.includes("\\"))).toBe(true);
    const chips = shownChips(equation);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((row) => row.chip.trim() && !row.shown.includes("\\") && !row.shown.includes("frac"))).toBe(true);
    expect(chips.map((row) => row.shown).join(" ")).toMatch(/3/);
    expect(chips.map((row) => row.chip).join(" ")).toMatch(/\^\{/);
  });

  it("keeps an unbraced model exponent and a slash exponent as a superscript fraction", () => {
    for (const equation of [
      String.raw`y = \frac{3}{\sqrt{2}} \times \sqrt{50}^\frac{3}{2}`,
      String.raw`y = \frac{3}{\sqrt{2}} \times 50^{3/4}`,
      String.raw`y = \frac{3}{\sqrt{2}} \times 50^(3/4)`,
    ]) {
      const shown = shownLine(equation);
      expect(shown).not.toMatch(/\\/);
      expect(shown).not.toContain("frac");
      expect(shownChips(equation).every((row) => !row.shown.includes("\\"))).toBe(true);
    }
  });

  it("draws each fractional exponent as a superscript on one power tile", () => {
    const lines = [
      String.raw`y = \frac{3}{\sqrt{2}} \times (50^{\frac{3}{2}})^{\frac{1}{2}}`,
      String.raw`y = \frac{3}{\sqrt{2}} \times 50^{\frac{3}{4}}`,
      String.raw`50^{\frac{3}{4}} = (2 \times 5^{2})^{\frac{3}{4}}`,
      String.raw`50^{\frac{3}{4}} = 2^{\frac{3}{4}} \times 5^{\frac{6}{4}}`,
      String.raw`50^{\frac{3}{4}} = 2^{\frac{3}{4}} \times 5^{\frac{3}{2}}`,
      String.raw`50^{\frac{3}{4}} = 2^{\frac{3}{4}} \times 5\sqrt{5}`,
      String.raw`y = \frac{3}{2^{\frac{1}{2}}} \times 5\sqrt{5} \times 2^{\frac{3}{4}}`,
      String.raw`y = 15\sqrt{5} \times 2^{\frac{3}{4}} - \frac{1}{2}`,
      String.raw`y = \frac{3}{\sqrt{2}} \times \sqrt{50^{\frac{3}{2}}}`,
      String.raw`50^{\frac{3}{4}} = (2 \times 5^2)^{\frac{3}{4}}`,
      String.raw`y = 15\sqrt{5} \times 2^{\frac{3}{4} - \frac{1}{2}}`,
      String.raw`50^\frac{3}{2}`,
    ];
    for (const equation of lines) {
      expect(shownLine(equation)).not.toMatch(/\\/);
      const chips = extractLine(equation).fillers;
      expect(chips.some((chip) => /[0-9√)]\^\{/.test(chip) || /[0-9]\^\{/.test(chip) || chip.includes(String.raw`^{\frac`))).toBe(true);
      const powers = chips.filter((chip) => chip.includes(String.raw`^{\frac`));
      expect(powers.length).toBeGreaterThan(0);
      for (const power of powers) {
        expect(power).toMatch(/[0-9√)]\^\{|\)\^\{/);
        const html = tileHtml(power);
        const base = power.replace(/\\times/g, "×").match(/[0-9]+|√|\)/)?.[0] ?? "";
        expect(isPowerTile(html, base)).toBe(true);
        expect(chips.filter((chip) => chip === power.replace(/^[0-9√()×]+/, ""))).not.toContain(power.slice(power.indexOf("\\frac")));
      }
    }
    expect(isPowerTile(tileHtml(String.raw`50^\frac{3}{4}`), "50")).toBe(true);
    expect(isPowerTile(tileHtml(String.raw`50^{3/4}`), "50")).toBe(true);
    const fifty = extractLine(String.raw`50^{\frac{3}{4}}`).fillers;
    expect(fifty).toEqual([String.raw`50^{\frac{3}{4}}`]);
    expect(isPowerTile(tileHtml(fifty[0]), "50")).toBe(true);
    expect(tokensFromEquation(String.raw`50^{\frac{3}{4}}`)).toEqual([String.raw`50^{\frac{3}{4}}`]);
    const difference = extractLine(String.raw`y = 15\sqrt{5} \times 2^{\frac{3}{4}} - \frac{1}{2}`).fillers;
    expect(difference.some((chip) => chip === String.raw`\frac{1}{2}` || chip === "1/2" || chip.includes("□/□"))).toBe(true);
    expect(difference.some((chip) => chip.includes("2") && chip.includes(String.raw`\frac{3}{4}`))).toBe(true);
  });

  it("does not drop a fractional-exponent chip as dirty or as a blank fragment", () => {
    const chips = extractLine(DIRECT[0]).fillers;
    expect(chips).toEqual(expect.arrayContaining(["y", "=", "3"]));
    expect(chips.some((chip) => chip.includes("50") && chip.includes(String.raw`\frac{3}{2}`))).toBe(true);
    expect(chips.every((chip) => !isStillDirty(chip))).toBe(true);
    const client = extractTermsFromAscii(DIRECT[0]).map((term) => term.body || term.display);
    expect(client.some((chip) => chip.includes("50") && chip.includes(String.raw`\frac{3}{2}`))).toBe(true);
  });
});
