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

/** Geometry-reference macro: `\georef{objectId}{label}`. */
const GEOREF = /\\georef\{[^}]*\}\{((?:[^{}]|\{[^{}]*\})*)\}/g;

/** Render a stored property statement as mathematics. Geometry references fall
 *  back to their label here, so no surface can ever leak the raw macro. */
export function renderStatement(value: string): ReactNode {
  if (!value) return null;
  const plain = value.replace(GEOREF, (_m, label) => label);
  try {
    return renderMathInline(normalizeMathSource(plain));
  } catch {
    return plain;
  }
}


/** Inline component form, for use directly inside JSX. */
export function MathText({ value }: { value: string }) {
  return <>{renderStatement(value)}</>;
}

export default MathText;
