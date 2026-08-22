// One display path for geometry-property mathematics.
//
// Input syntax is NOT display syntax: a property may store `\sqrt{S^2-Z^2}`
// or `\frac{S}{Y}`, but the teacher and student must always see real notation.
// This helper is the single place that turns a stored statement into pixels —
// it reuses the same `normalizeMathSource` → `renderMathInline` pipeline the
// lesson-note lines, the AI Edit preview and Smart Table cells already use.

import type { ReactNode } from "react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";

/** Render a stored property statement as mathematics. */
export function renderStatement(value: string): ReactNode {
  if (!value) return null;
  try {
    return renderMathInline(normalizeMathSource(value));
  } catch {
    return value;
  }
}

/** Inline component form, for use directly inside JSX. */
export function MathText({ value }: { value: string }) {
  return <>{renderStatement(value)}</>;
}

export default MathText;
