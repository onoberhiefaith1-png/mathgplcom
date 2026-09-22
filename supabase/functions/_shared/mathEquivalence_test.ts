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