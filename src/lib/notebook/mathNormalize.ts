// Single normalization entry point for mathematics.
//
// Every surface that turns a math *string* into something visible — the AI
// Edit preview, the editable `mathInline` node, and AI-produced text landing
// in the document — must call `normalizeMathSource` first. That way the same
// input always produces the same structure, and the Smartboard can never
// display a form the AI Edit preview would render differently.

import { normalizeMath } from "@/lib/notebook/mathRender";
import { normalizeMathLayout } from "@/lib/notebook/mathLayoutNormalize";

/** Close any dangling `{` so a partially-typed value still parses fully. */
export const balanceBraces = (v: string): string => {
  let opens = 0;
  for (const ch of v) {
    if (ch === "{") opens++;
    else if (ch === "}" && opens > 0) opens--;
  }
  return opens > 0 ? v + "}".repeat(opens) : v;
};

/**
 * Canonical math source: scaffolding removed, shorthand + symbol macros
 * folded to glyphs (exactly what `renderMathInline` does internally), braces
 * balanced. Structural macros (`\frac`, `\sqrt`, `\sum`, `\bar`, …) survive
 * untouched for the tree parser.
 */
export const normalizeMathSource = (raw: string): string => {
  if (!raw) return "";
  // Layout normalizer runs last: the stored/displayed string is already
  // tight, so no surface can reintroduce reserved spacing.
  return normalizeMathLayout(balanceBraces(normalizeMath(raw)));
};
