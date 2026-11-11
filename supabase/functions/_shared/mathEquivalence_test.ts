import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deterministicVerdict,
  equivalent,
  hasCompleteEquationShape,
} from "./mathEquivalence.ts";

Deno.test("an equation key rejects either side on its own", async () => {
  assertEquals(hasCompleteEquationShape("x + 7 = 12", "x + 7"), false);
  assertEquals(deterministicVerdict("x + 7 = 12", "x + 7"), "not_equal");
  assertEquals(await equivalent("x + 7 = 12", "12"), "not_equal");
});

Deno.test("an equation key rejects a dangling relation", async () => {
  assertEquals(hasCompleteEquationShape("x + 7 = 12", "x + 7 ="), false);
  assertEquals(await equivalent("x + 7 = 12", "x + 7 ="), "not_equal");
});

Deno.test("complete equivalent equations still earn the line", async () => {
  assertEquals(await equivalent("x + 7 = 12", "x + 7 = 12"), "equal");
  assertEquals(await equivalent("x + 7 = 12", "12 = 7 + x"), "equal");
  assertEquals(await equivalent("2x = 4", "x = 2"), "equal");
});

Deno.test("expression targets preserve expression equivalence", async () => {
  assertEquals(hasCompleteEquationShape("x + 7", "7 + x"), true);
  assertEquals(await equivalent("x + 7", "7 + x"), "equal");
});

Deno.test("quadratic formula substitution with ± and redundant brackets", async () => {
  const t = "x = (-(-2) ± sqrt(((-2)^2 - 4(5)(-4))))/(2(5))";
  assertEquals(await equivalent(t, "x = (-(-2) ± √((-2)^2 - 4(5)(-4)))/(2(5))"), "equal");
  assertEquals(await equivalent(t, "x = (2 ± sqrt(84))/10"), "equal");
  assertEquals(await equivalent(t, "x = (2 ± sqrt(80))/10"), "not_equal");
});
Deno.test("a LaTeX-spelled key matches the board's Unicode line (Σ, μ, x̄, units)", () => {
  assertEquals(deterministicVerdict("\\Sigma x=3+5+6+9+7", "Σx=3 +5 +6 +9 +7"), "equal");
  assertEquals(deterministicVerdict("\\sum x = 30", "Σx=30"), "equal");
  assertEquals(deterministicVerdict("\\mu=\\frac{\\Sigma x}{N}", "μ=Σx/N"), "equal");
  assertEquals(deterministicVerdict("\\mu=\\frac{30}{5}", "μ=30/5"), "equal");
  assertEquals(deterministicVerdict("\\mu=6\\text{cm}", "μ = 6 cm"), "equal");
  assertEquals(deterministicVerdict("(x-\\bar{x})^2", "(x−x̄)²"), "equal");
  assertEquals(deterministicVerdict("\\mu=6\\text{cm}", "μ=6"), "not_equal");
});
