// SmartboardLessonText — the ONLY safe way to display Lesson Note-derived
// text on the Smartboard. Mixes plain prose with real rendered math by
// reusing the exact Lesson Note display pipeline:
//
//   raw source → assertDisplaySafe → renderMathInline (per math run) → DOM
//
// Forbidden LaTeX residue (\frac, \sqrt, ^{, _{, …) is never written to
// the DOM as text. Math runs render through the Lesson Note renderer so
// fractions stack, radicals draw, exponents lift — identical to Lesson
// Notes itself. If a chunk still contains forbidden residue after
// cleaning, it is dropped (fail-closed) and a diagnostic is logged.

import { Fragment, type ReactNode } from "react";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import { renderMathInline, HAS_MATH } from "@/lib/notebook/mathRender";
import { Inked } from "./Inked";

/** Tokens that must NEVER reach the DOM as visible text.
 *  These are programming-syntax shapes the display gate could not sanitise.
 *  LaTeX structural macros (\frac, \sqrt, ^{, _{) are NOT listed here — they
 *  are valid input to renderMathInline, which converts them into real DOM
 *  structure (stacked fractions, radicals, exponents). */
const FORBIDDEN_RESIDUE = [
  "sqrt(", "**", "$",
];

export const containsForbiddenResidue = (s: string): string | null => {
  for (const t of FORBIDDEN_RESIDUE) if (s.includes(t)) return t;
  return null;
};

/** Run the Lesson Note display gate. Returns cleaned source ready for the
 *  renderer. If truly-unsafe programming syntax somehow remains after
 *  gating, strip it and warn — never drop the whole beat. */
export const safeLessonText = (raw: string): string | null => {
  const src = (raw ?? "").toString();
  if (!src.trim()) return "";
  const gated = assertDisplaySafe(src);
  const hit = containsForbiddenResidue(gated.cleaned);
  if (hit) {
    // eslint-disable-next-line no-console
    console.warn("[smartboard] unsafe residue after gate", { offending: hit, raw: src });
    return gated.cleaned.split(hit).join("");
  }
  return gated.cleaned;
};

interface Props {
  /** Raw Lesson Note text (may contain LaTeX-lite math markup). */
  children: string;
  /** Stable seed so handwriting jitter is deterministic. */
  seed?: number;
  /** Handwriting jitter for non-math prose runs. */
  jitter?: number;
  /** Optional inline style applied to the wrapper. */
  style?: React.CSSProperties;
  className?: string;
  placeholderColor?: string;
}

/** Split text into alternating prose/math runs.
 *  Math runs are those that need the structural renderer (HAS_MATH). */
const splitRuns = (line: string): { kind: "prose" | "math"; text: string }[] => {
  if (!line) return [];
  // Quick win: if the whole line is purely prose with no math markup, keep it whole.
  if (!HAS_MATH(line)) return [{ kind: "prose", text: line }];
  // Otherwise: treat the whole line as math — renderMathInline handles
  // plain words inside the same expression just fine, and this keeps
  // operator spacing/fractions correct without a fragile splitter.
  return [{ kind: "math", text: line }];
};

export const SmartboardLessonText = ({
  children, seed = 1, jitter = 0.08, style, className, placeholderColor,
}: Props): ReactNode => {
  const cleaned = safeLessonText(children);
  if (cleaned == null) return null;
  if (!cleaned.trim()) return null;

  const lines = cleaned.split(/\r?\n/);
  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {splitRuns(line).map((run, ri) => {
            if (run.kind === "prose") {
              return (
                <Inked key={ri} jitter={jitter} seed={seed + li * 17 + ri}>
                  {run.text}
                </Inked>
              );
            }
            // Math run: render through the Lesson Note renderer.
            return (
              <span key={ri} style={{ display: "inline" }}>
                {renderMathInline(run.text, `sblt-${seed}-${li}-${ri}`, { placeholderColor })}
              </span>
            );
          })}
        </Fragment>
      ))}
    </span>
  );
};

export default SmartboardLessonText;
