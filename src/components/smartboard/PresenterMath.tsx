// Single shared inline math renderer for every presenter-side surface
// (Presenter Preview normal mode, Reasoning panel, chips).
//
// RULE: raw LaTeX / markup must NEVER reach the screen anywhere in the app.
// Every string that could contain `\frac`, `\sqrt`, `^{}`, `_{}` must go
// through this component so it renders as real stacked math, identical to
// the teacher's orange equation in Presenter Preview normal mode.

import { renderMathInline } from "@/lib/notebook/mathRender";
import { normaliseExponentSyntax } from "@/lib/notebook/exponentForm";
import { PLACEHOLDER_COLOR } from "@/lib/smartboard/placeholderColor";
import { stripLatexScaffolding } from "@/lib/notebook/mathFriendly";

export const PRESENTER_INK = "#1a2230";

export const asDisplayString = (v: unknown): string => {
  if (v == null) return "";
  const t = typeof v;
  if (t === "string") return v as string;
  if (t === "number" || t === "boolean") return String(v);
  return "";
};

interface Props {
  ascii: unknown;
  /** Unique-ish key base so sibling renders don't collide. */
  keyBase?: string;
  placeholderColor?: string;
  /** Override ink colour (the Reasoning panel is themed, not paper). */
  color?: string;
  className?: string;
}

/** Render an expression exactly as the presenter's normal-mode line does. */
export const PresenterMath = ({
  ascii,
  keyBase = "presenter-inline",
  placeholderColor = PLACEHOLDER_COLOR,
  color = PRESENTER_INK,
  className = "font-serif",
}: Props) => {
  const src = normaliseExponentSyntax(asDisplayString(ascii));
  return (
    <span className={className} style={{ color }}>
      {renderMathInline(src, keyBase, { placeholderColor })}
    </span>
  );
};

/** Defensive pre-pass for sources that may still carry raw scaffolding
 *  (legacy answer keys, token joins). Never returns LaTeX commands. */
export const toDisplaySafe = (v: unknown): string => {
  const raw = normaliseExponentSyntax(asDisplayString(v).trim());
  if (!raw) return "";
  // Keep renderer-safe commands (\frac, \sqrt, ^{}) for PresenterMath.
  // Anything else is stripped so a stray command cannot be painted as text.
  return /\\[A-Za-z]|[\^_]\{/.test(raw) ? raw : stripLatexScaffolding(raw);
};

export default PresenterMath;
