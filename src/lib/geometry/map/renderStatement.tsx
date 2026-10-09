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

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  n: "ⁿ", i: "ⁱ",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
};

const scripted = (value: string, map: Record<string, string>): string =>
  [...value].map((character) => map[character] ?? character).join("");

const STRUCTURAL_MACROS = new Set([
  "frac", "sqrt", "sum", "prod", "coprod", "int", "oint", "lim",
  "log", "ln", "lg", "vec", "hat", "bar", "tilde", "dot", "binom",
  "abs", "norm", "floor", "ceil", "begin", "end",
]);

/** Keep renderer instructions internal and turn any unknown legacy command
 * into ordinary classroom wording before React receives it. */
export function geometryClassroomSource(value: string): string {
  const normalized = normalizeMathSource(
    value.replace(GEOREF, (_match, label: string) => label),
  );
  return normalized.replace(/\\([A-Za-z]+)\b/g, (command, name: string) =>
    STRUCTURAL_MACROS.has(name) ? command : name,
  );
}

/**
 * A display-only last line of defence. Geometry properties can outlive parser
 * versions, so an old or partially malformed statement must degrade to clean
 * classroom symbols — never expose its storage commands to a teacher/student.
 */
export function geometryClassroomFallback(value: string): string {
  return value
    .replace(GEOREF, (_match, label: string) => label)
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1⁄$2")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
    .replace(/\^\{([^{}]*)\}/g, (_match, body: string) => scripted(body, SUPERSCRIPT))
    .replace(/_\{([^{}]*)\}/g, (_match, body: string) => scripted(body, SUBSCRIPT))
    .replace(/\\(?:times|cdot)\b/g, "×")
    .replace(/\\div\b/g, "÷")
    .replace(/\\(?:leq|le)\b/g, "≤")
    .replace(/\\(?:geq|ge)\b/g, "≥")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\pm\b/g, "±")
    .replace(/\\angle\b/g, "∠")
    .replace(/\\([A-Za-z]+)\b/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Render a stored property statement as mathematics. Geometry references fall
 *  back to their label here, so no surface can ever leak the raw macro. */
export function renderStatement(value: string): ReactNode {
  if (!value) return null;
  try {
    return renderMathInline(geometryClassroomSource(value));
  } catch {
    return geometryClassroomFallback(value);
  }
}


/** Inline component form, for use directly inside JSX. */
export function MathText({ value }: { value: string }) {
  return <>{renderStatement(value)}</>;
}

export default MathText;
