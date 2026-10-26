import { describe, expect, it } from "vitest";
import {
  tokenizeMath,
  tokenizeMathV2,
  tokenizerFor,
  readFractionAt,
} from "@/lib/notebook/mathTokens";

describe("tokenizeMathV2 — whitespace inside fractions", () => {
  it.each([
    ["\\frac {3}{4}"],
    ["\\frac{3} {4}"],
    ["\\frac {3} {4}"],
    ["\\frac 3 4"],
    ["\\dfrac {a+b} {2c}"],
    ["\\cfrac{1} {2}"],
    ["\\tfrac 1 2"],
  ])("%s is one fraction token", (src) => {
    expect(tokenizeMathV2(src)).toEqual([src]);
  });

  it("the original tokenizer is unchanged (it still splits them)", () => {
    expect(tokenizeMath("\\frac {3}{4}")).toEqual(["\\frac", "{3}{4}"]);
    expect(tokenizeMath("\\frac{3} {4}")).toEqual(["\\frac{3}", "{4}"]);
    expect(tokenizeMath("\\frac 3 4")).toEqual(["\\frac", "3", "4"]);
  });

  it("keeps the rest of the line separate", () => {
    expect(tokenizeMathV2("x = \\frac {3} {4} + 1")).toEqual([
      "x",
      "=",
      "\\frac {3} {4}",
      "+",
      "1",
    ]);
  });

  it("an incomplete fraction falls back to reading it as before", () => {
    expect(tokenizeMathV2("\\frac")).toEqual(["\\frac"]);
    expect(tokenizeMathV2("\\frac {")).toEqual(tokenizeMath("\\frac {"));
    expect(readFractionAt("\\frac{1}", 0)).toBe(-1);
  });
});

describe("tokenizeMathV2 — a fraction inside an unspaced expression is selectable", () => {
  it("splits off after an equals sign", () => {
    expect(tokenizeMathV2("x=\\dfrac{a+b}{2c}")).toEqual([
      "x=",
      "\\dfrac{a+b}{2c}",
    ]);
  });

  it("splits around an operator macro", () => {
    expect(tokenizeMathV2("\\frac{1}{2}\\times\\frac{3}{5}")).toEqual([
      "\\frac{1}{2}",
      "\\times",
      "\\frac{3}{5}",
    ]);
    expect(tokenizeMathV2("\\frac{1}{2}\\div\\frac{3}{5}")).toEqual([
      "\\frac{1}{2}",
      "\\div",
      "\\frac{3}{5}",
    ]);
  });

  it("a sign stays with the fraction it belongs to", () => {
    expect(tokenizeMathV2("\\frac{1}{2}+\\frac{1}{3}")).toEqual([
      "\\frac{1}{2}",
      "+\\frac{1}{3}",
    ]);
    expect(tokenizeMathV2("x=-\\frac{1}{2}")).toEqual(["x=", "-\\frac{1}{2}"]);
  });

  it("keeps a mixed number or coefficient with its fraction", () => {
    expect(tokenizeMathV2("1\\frac{1}{2}")).toEqual(["1\\frac{1}{2}"]);
    expect(tokenizeMathV2("2\\frac{x}{3}")).toEqual(["2\\frac{x}{3}"]);
    expect(tokenizeMathV2("\\frac{1}{2}x")).toEqual(["\\frac{1}{2}x"]);
  });

  it("never splits inside brackets, braces or \\left…\\right", () => {
    expect(tokenizeMathV2("(\\frac{1}{2}+\\frac{1}{3})")).toEqual([
      "(\\frac{1}{2}+\\frac{1}{3})",
    ]);
    expect(tokenizeMathV2("{\\frac{1}{2} + 3}")).toEqual([
      "{\\frac{1}{2} + 3}",
    ]);
    expect(tokenizeMathV2("\\left(\\frac{1}{2}\\right)^2")).toEqual([
      "\\left(\\frac{1}{2}\\right)^2",
    ]);
    expect(tokenizeMathV2("\\frac{\\sqrt{2}}{2}")).toEqual([
      "\\frac{\\sqrt{2}}{2}",
    ]);
  });

  it("keeps a power on the fraction with it", () => {
    expect(tokenizeMathV2("\\frac{1}{2}^2")).toEqual(["\\frac{1}{2}^2"]);
  });

  it("joining the tokens always reproduces the non-space content of the line", () => {
    const squash = (s: string) => s.replace(/\s+/g, "");
    for (const s of [
      "x=\\dfrac{a+b}{2c}",
      "\\frac{1}{2}\\times\\frac{3}{5}",
      "\\frac{1}{2}+\\frac{1}{3}-\\frac 1 4",
      "a = \\frac {1} {2} \\times 4",
      "(\\frac{1}{2}+\\frac{1}{3})^2 = x",
      "x=-\\frac{1}{2}",
      "\\frac12 3",
    ]) {
      expect(squash(tokenizeMathV2(s).join(""))).toBe(squash(s));
    }
  });
});

describe("tokenizeMathV2 — already-working input is unchanged", () => {
  // Every one of these tokenised cleanly with the original tokenizer; v2 must
  // produce the very same tokens so saved highlights keep their meaning.
  const corpus = [
    "x = \\frac{3}{4} + \\frac{1}{2}",
    "a = \\frac{1}{2} \\times 4",
    "\\frac{3}{4} x",
    "\\frac{1}{2}x = 4",
    "1\\frac{1}{2} + 2/3",
    "2\\frac{x}{3}",
    "(\\frac{1}{2}+\\frac{1}{3})",
    "\\left(\\frac{1}{2}\\right)^2",
    "\\frac{\\sqrt{2}}{2}",
    "{\\frac{1}{2} + 3}",
    "\\cfrac{1}{2}",
    "\\frac{1}{2}^2x",
    "\\frac34 + 1",
    "\\frac12 3",
    "2x+3=7",
    "2x + 3 = 7",
    "S = \\sum_{i = 1}^{n} i^{2}",
    "\\int_{0}^{1} x dx",
    "A = \\begin{bmatrix}2 & 1 \\\\ 3 & 4\\end{bmatrix}",
    "\\begin{pmatrix}\\frac{1}{2} & 0\\end{pmatrix}",
    "\\left( a + b \\right) = c",
    "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
    "x ½ ¾ y",
    "Let x be the number of apples",
    "",
  ];
  it.each(corpus.map((c) => [c]))("%s", (src) => {
    expect(tokenizeMathV2(src)).toEqual(tokenizeMath(src));
  });
});

describe("tokenizerFor", () => {
  it("returns the frozen original for version 1 and v2 for version 2", () => {
    expect(tokenizerFor(1)).toBe(tokenizeMath);
    expect(tokenizerFor(2)).toBe(tokenizeMathV2);
  });
});
