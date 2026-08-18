// Classroom math renderer: converts mixed teacher/AI text into real notebook
// mathematics. Handles LaTeX-style markup (\frac{}{}, \sqrt{}, ^{}, _{},
// \sum_{}^{}, \int_{}^{}, \prod, \lim, matrices, vectors, accents, slots…),
// shorthand (x^2, log_2, sqrt(16)), and ascii operators (*, <=, >=, !=, +-).
//
// THE THREE-ZONE MODEL (matches a teacher's handwriting on ruled paper):
//
//   ─── upper zone ───  numerators, exponents, root interiors, ∑ upper bound
//   ─── baseline ────   variables, coefficients, operators, = signs, frac BAR
//   ─── lower zone ───  denominators, log bases, subscripts, ∑ lower bound
//
// Every structural renderer anchors to the parent text BASELINE.
// Editable mode: empty `\sl{}` slots render as dashed clickable boxes;
// non-empty slots render their contents transparently (no border).

import { createElement, type CSSProperties, type ReactNode } from "react";
import { EMOJI_STYLE, graphemes, isEmoji, stripBrokenGlyphs } from "@/lib/text/graphemes";
import { PLACEHOLDER_COLOR, smartboardPlaceholderStyle } from "@/lib/smartboard/placeholderColor";

/* ─── Connected radical helper ─────────────────────────────────────────────
 * Builds the SAME shape as <ConnectedRadical/>: an inline-flex with a
 * stretched SVG hook whose top-right tip meets the overline wrapper's
 * top-left. Uses createElement because this module is not JSX. */
const RADICAL_HOOK = createElement(
  "svg",
  {
    viewBox: "0 0 16 100",
    preserveAspectRatio: "none",
    style: { width: "0.5em", height: "100%", display: "block", overflow: "visible" },
    "aria-hidden": true,
  },
  createElement("path", {
    d: "M0 65 L4 65 L8 95 L16 0",
    stroke: "currentColor",
    strokeWidth: 2,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
    strokeLinejoin: "miter",
    strokeLinecap: "round",
  }),
);

/** Superscript-like content inside a radicand pushes above its own line box.
 *  The radical must reserve that space so the overline never crosses it.
 *  Returns a top padding (em) for the overline wrapper. */
export const radicalHeadroom = (inner: string): number => {
  if (!inner) return 0.06;
  const hasScript = /\^|[²³¹⁰⁴⁵⁶⁷⁸⁹]/.test(inner);
  const hasStack = /\\frac|\\dfrac|\\tfrac|\\binom|\\sqrt|\\sum|\\prod|\\int|\\lim/.test(inner);
  if (hasScript && hasStack) return 0.46;
  if (hasScript) return 0.34;
  if (hasStack) return 0.14;
  return 0.06;
};

const connectedRadical = (
  key: string,
  radicand: ReactNode,
  degree: ReactNode | null,
  dataMathSrc: string,
  headroom = 0.06,
): ReactNode =>

  createElement(
    "span",
    {
      key,
      "data-math-kind": "radical",
      "data-math-src": dataMathSrc,
      style: {
        display: "inline-flex",
        alignItems: "stretch",
        verticalAlign: "middle",
        margin: "0 2px",
        lineHeight: 1.05,
      },
    },
    degree
      ? createElement(
          "span",
          {
            key: "deg",
            style: {
              fontSize: "0.55em",
              display: "inline-flex",
              alignItems: "flex-start",
              transform: "translateY(-0.35em)",
              marginRight: "-0.15em",
              minWidth: "0.7em",
              justifyContent: "center",
              lineHeight: 1,
            },
          },
          degree,
        )
      : null,
    createElement(
      "span",
      { key: "hook", style: { display: "inline-flex", alignSelf: "stretch", flex: "0 0 auto" } },
      RADICAL_HOOK,
    ),
    createElement(
      "span",
      {
        key: "bar",
        style: {
          borderTop: "1.4px solid currentColor",
          paddingTop: `${headroom}em`,
          paddingLeft: "3px",
          paddingRight: "3px",
          display: "inline-flex",
          alignItems: "center",
          flex: "1 1 auto",
          minWidth: "0.5em",
          marginLeft: "-1px",
        },
      },
      radicand,
    ),
  );

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
  nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ",
  Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

/** Macros that map directly to a glyph (after normalize). */
const MACRO_GLYPH: Record<string, string> = {
  partial: "∂", nabla: "∇", infty: "∞", ell: "ℓ", hbar: "ℏ",
  Re: "ℜ", Im: "ℑ", aleph: "ℵ",
  emptyset: "∅", varnothing: "∅",
  forall: "∀", exists: "∃", nexists: "∄",
  in: "∈", notin: "∉", ni: "∋",
  subset: "⊂", supset: "⊃", subseteq: "⊆", supseteq: "⊇",
  cap: "∩", cup: "∪", setminus: "∖",
  land: "∧", lor: "∨", lnot: "¬", neg: "¬",
  implies: "⇒", impliedby: "⇐", iff: "⇔",
  therefore: "∴", because: "∵",
  vdash: "⊢", models: "⊨",
  perp: "⊥", top: "⊤", parallel: "∥",
  angle: "∠", measuredangle: "∡", triangle: "△", square: "□", bigcirc: "◯",
  cong: "≅", sim: "∼", simeq: "≃", equiv: "≡", propto: "∝",
  ll: "≪", gg: "≫",
  oplus: "⊕", otimes: "⊗", odot: "⊙", circ: "∘",
  ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱",
  prime: "′", mapsto: "↦", longrightarrow: "⟶", rightharpoonup: "⇀",
  leftrightarrow: "↔", longleftrightarrow: "⟷",
  // blackboard bold
  N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ", C: "ℂ", P: "ℙ",
};

/** Replace ascii-shorthand & latex-shorthand into the cleaner forms the renderer expects. */
export const normalizeMath = (raw: string): string => {
  if (!raw) return "";
  let s = raw;
  // Strip KaTeX-style $...$ / $$...$$ delimiters before any other parsing —
  // they are valid in source but must never reach the rendered DOM as text.
  s = s.replace(/\$+/g, "");
  // Strip LaTeX scaffolding that should NEVER appear visually on the board.
  s = s.replace(/\\left\s*([\(\[\{\|])/g, "$1");
  s = s.replace(/\\right\s*([\)\]\}\|])/g, "$1");
  s = s.replace(/\\left\./g, "").replace(/\\right\./g, "");
  s = s.replace(/\\,|\\;|\\:|\\!|\\quad|\\qquad/g, " ");
  s = s.replace(/\\displaystyle\b/g, "").replace(/\\text\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\times\b/g, "×");
  s = s.replace(/\\cdot\b/g, "·");
  s = s.replace(/\\pm\b/g, "±");
  s = s.replace(/\\mp\b/g, "∓");
  s = s.replace(/\\leq\b/g, "≤");
  s = s.replace(/\\geq\b/g, "≥");
  s = s.replace(/\\neq\b/g, "≠");
  s = s.replace(/\\div\b/g, "÷");
  s = s.replace(/\\to\b/g, "→");
  s = s.replace(/\\infty\b/g, "∞");
  s = s.replace(/\\approx\b/g, "≈");
  s = s.replace(/\\([A-Za-z]+)/g, (m, name) => {
    // Structural macros are handled later by the parser.
    if (
      name === "frac" || name === "sqrt" || name === "sum" || name === "prod" ||
      name === "int" || name === "oint" || name === "lim" || name === "log" ||
      name === "ln" || name === "lg" || name === "sl" || name === "vec" ||
      name === "hat" || name === "bar" || name === "tilde" || name === "dot" ||
      name === "binom" || name === "abs" || name === "norm" || name === "floor" ||
      name === "ceil" || name === "begin" || name === "end"
    ) return m;
    if (GREEK[name]) return GREEK[name];
    if (MACRO_GLYPH[name]) return MACRO_GLYPH[name];
    return m;
  });
  s = s.replace(/(\d)\s*\*\s*(\d|[a-zA-Z(])/g, "$1×$2");
  s = s.replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/!=/g, "≠");
  s = s.replace(/\+-/g, "±");
  s = s.replace(/sqrt\s*\(([^()]+)\)/gi, (_m, inner) => `\\sqrt{${inner}}`);
  s = s.replace(/\^([0-9]+|[a-zA-Z])/g, (_m, p1) => `^{${p1}}`);
  s = s.replace(/_([0-9]+|[a-zA-Z])/g, (_m, p1) => `_{${p1}}`);
  return s;
};

/** Classroom row-height oracle. Rows must NOT compress mathematics. */
export const mathLineMinHeight = (raw: string, base = 32, next?: string): number => {
  const s = normalizeMath(raw);
  let h = base;
  if (s.trim()) {
    const fracCount = (s.match(/\\frac\{/g) || []).length;
    const sqrtCount = (s.match(/\\sqrt(?:\[[^\]]*\])?\{/g) || []).length;
    const supCount = (s.match(/\^\{/g) || []).length;
    const subCount = (s.match(/_\{/g) || []).length;
    const hasMatrix = /\\begin\{(?:p|b|v)?matrix\}/.test(raw) || /\\begin\{cases\}/.test(raw);
    const nestedFrac = /\\frac\{[^{}]*\\frac\{/.test(s);
    const hasBig = /\\sum|\\prod|\\int|\\oint|\\lim/.test(s);
    if (hasMatrix) h = Math.max(112, h);
    else if (nestedFrac) h = 92;
    else if (hasBig) h = 96;
    else if (fracCount >= 2) h = 88;
    else if (fracCount === 1 && sqrtCount >= 1) h = 78;
    else if (fracCount === 1 && (supCount + subCount) >= 1) h = 76;
    else if (fracCount === 1) h = 64;
    else if (sqrtCount >= 1 && (supCount + subCount) >= 1) h = 60;
    else if (sqrtCount >= 1) h = 52;
    else if (supCount + subCount >= 1) h = 40;
  }
  if (next) {
    const n = normalizeMath(next);
    const nextHasUpper = /\\sqrt|\\frac\{|\^\{|\\sum|\\prod|\\int|\\lim|\\begin\{/.test(n);
    if (nextHasUpper) h += 8;
  }
  return h;
};

/** True if a string needs the structural renderer (vs flat text). */
export const HAS_MATH = (s: string): boolean => {
  const n = normalizeMath(s);
  return /\\frac\{|\\sqrt(?:\[[^\]]*\])?\{|\\sum|\\prod|\\int|\\oint|\\lim|\\begin\{|\\vec|\\hat|\\bar|\\binom|\\abs|\\norm|\\floor|\\ceil|\\sl\{|\^\{|_\{|[²³¹⁰⁴⁵⁶⁷⁸⁹₀-₉×÷±≤≥≠√→∞≈π·∛∜]/.test(n);
};

/* ------------------------- options ------------------------- */

export interface RenderOptions {
  /** Enable interactive editable slots. */
  editable?: boolean;
  /** Currently-focused slot index (depth-first across the line). */
  focusedSlot?: number | null;
  /** Click handler — receives the global slot index. */
  onSlotClick?: (slotIndex: number) => void;
  /** Ink colour used to paint the focused slot caret. */
  caretColor?: string;
  /** Empty placeholder colour. Kept separate from ink/structure colour. */
  placeholderColor?: string;
}

interface RenderCtx {
  opts: RenderOptions;
  /** Mutable shared counter so nested calls produce consecutive slot indices. */
  slotCounter: { n: number };
}

/* ------------------------- structural primitives ------------------------- */

function fractionSpan(numerator: ReactNode, denominator: ReactNode, key: string, withBar = true, source?: string): ReactNode {
  return createElement(
    "span",
    {
      key,
      "data-math-kind": source ? "fraction" : undefined,
      "data-math-src": source,
      style: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        verticalAlign: "baseline",
        margin: "0 3px",
        lineHeight: 1,
        fontSize: "0.92em",
        transform: "translateY(-0.38em)",
      } as CSSProperties,
    },
    createElement("span", { key: "n", "data-math-role": source ? "numerator" : undefined, style: { padding: "0 3px 2px", whiteSpace: "nowrap" } }, numerator),
    createElement("span", {
      key: "b",
      "data-math-role": source ? "bar" : undefined,
      style: {
        display: "block",
        width: "100%",
        height: 0,
        borderTop: withBar ? "1.4px solid currentColor" : "none",
      },
    }),
    createElement("span", { key: "d", "data-math-role": source ? "denominator" : undefined, style: { padding: "2px 3px 0", whiteSpace: "nowrap" } }, denominator),
  );
}

function emptySlotBox(idx: number, ctx: RenderCtx, key: string): ReactNode {
  const focused = ctx.opts.focusedSlot === idx;
  const click = ctx.opts.onSlotClick;
  const placeholderColor = ctx.opts.placeholderColor ?? PLACEHOLDER_COLOR;
  return createElement(
    "span",
    {
      key,
      "data-slot-idx": idx,
      "data-sb-placeholder": "math-render",
      onPointerDown: click
        ? (e: React.PointerEvent) => {
            // preventDefault so the browser doesn't focus this span and
            // steal focus from the hidden writing textarea.
            e.preventDefault();
            e.stopPropagation();
            click(idx);
          }
        : undefined,
      style: smartboardPlaceholderStyle(placeholderColor, {
        size: "inline",
        active: focused,
        caretColor: ctx.opts.caretColor,
        cursor: click ? "text" : "default",
      }) as CSSProperties,
    } as React.HTMLAttributes<HTMLSpanElement> & Record<string, unknown>,
  );
}

const emptyIfBlank = (raw: string, key: string, ctx: RenderCtx): ReactNode[] => {
  if (raw.trim().length === 0) {
    return [emptySlotBox(ctx.slotCounter.n++, ctx, key)];
  }
  return renderInner(raw, key, ctx);
};

function filledSlotSpan(idx: number, content: ReactNode[], ctx: RenderCtx, key: string): ReactNode {
  const focused = ctx.opts.focusedSlot === idx;
  const click = ctx.opts.onSlotClick;
  return createElement(
    "span",
    {
      key,
      "data-slot-idx": idx,
      onPointerDown: click
        ? (e: React.PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            click(idx);
          }
        : undefined,
      style: {
        display: "inline-flex",
        alignItems: "baseline",
        verticalAlign: "baseline",
        cursor: click ? "text" : "default",
        padding: "0 1px",
        borderBottom: focused ? `1.4px solid ${ctx.opts.caretColor ?? "currentColor"}` : "none",
        touchAction: "manipulation",
      } as CSSProperties,
    } as React.HTMLAttributes<HTMLSpanElement> & Record<string, unknown>,
    content,
  );
}

/** Read a brace-balanced `{...}` group starting at `start` (which must be `{`). */
function readBraced(src: string, start: number): { inner: string; end: number } | null {
  if (src[start] !== "{") return null;
  let depth = 1;
  let j = start + 1;
  while (j < src.length && depth > 0) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") depth--;
    if (depth) j++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(start + 1, j), end: j + 1 };
}

/** Try to consume optional `_{...}` and `^{...}` immediately after position `i`,
 *  in any order. Returns the bounds and the new position. */
function readBigOpBounds(src: string, i: number): { lower?: string; upper?: string; end: number } {
  let lower: string | undefined;
  let upper: string | undefined;
  let p = i;
  for (let pass = 0; pass < 2; pass++) {
    // skip optional whitespace
    while (p < src.length && src[p] === " ") p++;
    if (src[p] === "_" && lower === undefined) {
      const a = readBraced(src, p + 1);
      if (a) { lower = a.inner; p = a.end; continue; }
    }
    if (src[p] === "^" && upper === undefined) {
      const a = readBraced(src, p + 1);
      if (a) { upper = a.inner; p = a.end; continue; }
    }
    break;
  }
  return { lower, upper, end: p };
}

/** Stacked big-operator: upper above glyph above lower. */
function bigOperatorStack(
  glyph: string, lower: ReactNode | null, upper: ReactNode | null, key: string,
): ReactNode {
  return createElement(
    "span",
    {
      key,
      style: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        verticalAlign: "baseline",
        margin: "0 2px",
        lineHeight: 1,
        transform: "translateY(-0.35em)",
      } as CSSProperties,
    },
    createElement("span", {
      key: "u",
      style: { fontSize: "0.62em", minHeight: "0.7em", lineHeight: 1 },
    }, upper ?? ""),
    createElement("span", {
      key: "g",
      style: { fontSize: "1.6em", lineHeight: 1, fontFamily: '"Cambria Math", "STIX Two Math", "Times New Roman", serif' },
    }, glyph),
    createElement("span", {
      key: "l",
      style: { fontSize: "0.62em", minHeight: "0.7em", lineHeight: 1, marginTop: 1 },
    }, lower ?? ""),
  );
}

/** Matrix-style grid, optionally wrapped in left/right brackets. */
function matrixSpan(
  rows: ReactNode[][], left: string, right: string, key: string,
): ReactNode {
  const grid = createElement(
    "span",
    {
      key: "g",
      style: {
        display: "inline-grid",
        gridTemplateColumns: `repeat(${rows[0]?.length ?? 1}, auto)`,
        columnGap: "0.9em",
        rowGap: "0.25em",
        alignItems: "center",
        justifyItems: "center",
        verticalAlign: "middle",
        lineHeight: 1.1,
        padding: "0 0.25em",
      } as CSSProperties,
    },
    rows.flatMap((row, r) => row.map((cell, c) =>
      createElement("span", { key: `r${r}c${c}`, style: { whiteSpace: "nowrap" } }, cell),
    )),
  );
  if (!left && !right) return createElement("span", { key, style: { verticalAlign: "middle", display: "inline-flex", alignItems: "center" } }, grid);
  const bracketStyle: CSSProperties = {
    fontSize: `${Math.max(1.6, rows.length * 1.0)}em`,
    lineHeight: 1,
    fontFamily: '"Cambria Math", "STIX Two Math", "Times New Roman", serif',
    display: "inline-block",
    verticalAlign: "middle",
  };
  return createElement(
    "span",
    {
      key,
      style: { display: "inline-flex", alignItems: "center", verticalAlign: "middle", margin: "0 2px" },
    },
    createElement("span", { key: "L", style: bracketStyle }, left),
    grid,
    createElement("span", { key: "R", style: bracketStyle }, right),
  );
}

/** Accent (vec / hat / bar / tilde / dot) over content. */
function accentSpan(symbol: string, content: ReactNode, key: string): ReactNode {
  return createElement(
    "span",
    {
      key,
      style: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        verticalAlign: "baseline",
        lineHeight: 1,
      } as CSSProperties,
    },
    createElement("span", {
      key: "a",
      style: {
        fontSize: "0.75em",
        lineHeight: 1,
        marginBottom: "-0.15em",
        height: "0.5em",
      },
    }, symbol),
    createElement("span", { key: "b" }, content),
  );
}

/* ------------------------- main parser ------------------------- */

/** Public entry. Walks the string, producing ReactNodes. */

/** Split text into consecutive emoji / non-emoji runs. */
function splitEmojiRuns(text: string): { text: string; emoji: boolean }[] {
  const gs = graphemes(text);
  const runs: { text: string; emoji: boolean }[] = [];
  for (const g of gs) {
    const e = isEmoji(g);
    const last = runs[runs.length - 1];
    if (last && last.emoji === e) last.text += g;
    else runs.push({ text: g, emoji: e });
  }
  return runs;
}

export function renderMathInline(
  srcRaw: string,
  keyBase = "m",
  opts: RenderOptions = {},
): ReactNode[] {
  const ctx: RenderCtx = { opts, slotCounter: { n: 0 } };
  return renderInner(stripBrokenGlyphs(normalizeMath(srcRaw)), keyBase, ctx);
}

function renderInner(src: string, keyBase: string, ctx: RenderCtx): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      // Emoji keep their own identity: native colour font, never the ink
      // colour. Split the buffer into emoji / non-emoji runs.
      const parts = splitEmojiRuns(buf);
      for (const part of parts) {
        out.push(
          createElement(
            "span",
            {
              key: `${keyBase}-t-${k++}`,
              style: part.emoji ? EMOJI_STYLE : undefined,
            },
            part.text,
          ),
        );
      }
      buf = "";
    }
  };

  while (i < src.length) {
    // ---- literal placeholder glyph ----
    // Some lesson-note/floating generator safety paths produce `□` directly
    // (for example an incomplete fraction shell). Treat it as a real
    // placeholder slot, never as ink-coloured text.
    if (src[i] === "□") {
      flush();
      out.push(emptySlotBox(ctx.slotCounter.n++, ctx, `${keyBase}-sq-${k++}`));
      i++;
      continue;
    }

    // ---- editable slot ----
    if (src.startsWith("\\sl{", i)) {
      const a = readBraced(src, i + 3);
      if (a) {
        flush();
        const idx = ctx.slotCounter.n++;
        if (ctx.opts.editable) {
          if (a.inner.trim().length === 0) {
            out.push(emptySlotBox(idx, ctx, `${keyBase}-sl-${k++}`));
          } else {
            const inner = renderInner(a.inner, `${keyBase}-slb${k}`, ctx);
            out.push(filledSlotSpan(idx, inner, ctx, `${keyBase}-sl-${k++}`));
          }
        } else {
          // Non-editable callers still render placeholders with the dedicated
          // placeholder colour, never with inherited ink/currentColor.
          if (a.inner.trim().length === 0) {
            out.push(emptySlotBox(idx, ctx, `${keyBase}-sl-${k++}`));
          } else {
            out.push(...renderInner(a.inner, `${keyBase}-slb${k}`, ctx));
          }
        }
        i = a.end;
        continue;
      }
    }

    // ---- log / ln / lg with explicit base ----
    const logMatch = /^(log|ln|lg)_\{/i.exec(src.slice(i));
    if (logMatch) {
      const name = logMatch[1];
      const a = readBraced(src, i + name.length + 1);
      if (a) {
        flush();
        out.push(
          createElement(
            "span",
            { key: `${keyBase}-lg-${k++}`, style: { display: "inline-flex", alignItems: "baseline" } },
            createElement("span", { key: "nm" }, name),
            createElement(
              "sub",
              {
                key: "bs",
                style: { fontSize: "0.7em", position: "relative", top: "0.35em", marginLeft: "1px", lineHeight: 1 },
              },
              renderInner(a.inner, `${keyBase}-lgb${k}`, ctx),
            ),
          ),
        );
        i = a.end;
        continue;
      }
    }

    // ---- fraction ----
    if (src.startsWith("\\frac", i)) {
      const a = readBraced(src, i + 5);
      const b = a ? readBraced(src, a.end) : null;
      if (a && b) {
        flush();
        out.push(
          fractionSpan(
            emptyIfBlank(a.inner, `${keyBase}-n${k}`, ctx),
            emptyIfBlank(b.inner, `${keyBase}-d${k}`, ctx),
            `${keyBase}-f-${k++}`,
            true,
            `\\frac{${a.inner}}{${b.inner}}`,
          ),
        );
        i = b.end;
        continue;
      }
      // Unbalanced \frac — never leak raw markup, and never leave orphan
      // placeholder boxes beside the shell. If the braces were stripped by an
      // upstream pass (`\frac{□}{□}` → `\frac□□`), adopt the two following
      // placeholder glyphs as numerator/denominator so the object keeps
      // exactly two cells instead of showing four.
      flush();
      let j = i + 5;
      const eatSlot = (): boolean => {
        let p = j;
        while (src[p] === " ") p++;
        if (src[p] === "□") { j = p + 1; return true; }
        return false;
      };
      eatSlot();
      eatSlot();
      out.push(
        fractionSpan(
          emptySlotBox(ctx.slotCounter.n++, ctx, `${keyBase}-fn${k}`),
          emptySlotBox(ctx.slotCounter.n++, ctx, `${keyBase}-fd${k}`),
          `${keyBase}-fb-${k++}`,
        ),
      );
      i = j;
      continue;
    }

    // ---- binom ----
    if (src.startsWith("\\binom", i)) {
      const a = readBraced(src, i + 6);
      const b = a ? readBraced(src, a.end) : null;
      if (a && b) {
        flush();
        const stack = fractionSpan(
          renderInner(a.inner, `${keyBase}-bn${k}`, ctx),
          renderInner(b.inner, `${keyBase}-bd${k}`, ctx),
          `${keyBase}-bk-${k}`,
          false,
        );
        const bracketStyle: CSSProperties = {
          fontSize: "1.7em", lineHeight: 1,
          fontFamily: '"Cambria Math", "STIX Two Math", serif',
          display: "inline-block", verticalAlign: "middle",
        };
        out.push(createElement(
          "span",
          { key: `${keyBase}-bn-${k++}`, style: { display: "inline-flex", alignItems: "center" } },
          createElement("span", { key: "L", style: bracketStyle }, "("),
          stack,
          createElement("span", { key: "R", style: bracketStyle }, ")"),
        ));
        i = b.end;
        continue;
      }
    }

    // ---- \sqrt[n]{x} ----
    if (src.startsWith("\\sqrt[", i)) {
      const close = src.indexOf("]", i + 6);
      if (close > 0 && src[close + 1] === "{") {
        const a = readBraced(src, close + 1);
        if (a) {
          const idxStr = src.slice(i + 6, close);
          const indexNodes = renderInner(idxStr, `${keyBase}-rni${k}`, ctx);
          flush();
          out.push(connectedRadical(
            `${keyBase}-rn-${k++}`,
            emptyIfBlank(a.inner, `${keyBase}-rnb${k}`, ctx),
            indexNodes,
            `\\sqrt[${idxStr}]{${a.inner}}`,
            radicalHeadroom(a.inner),

          ));
          i = a.end;
          continue;
        }
      }
    }

    // ---- \sqrt{x} ----
    if (src.startsWith("\\sqrt", i)) {
      const a = readBraced(src, i + 5);
      if (a) {
        flush();
        out.push(connectedRadical(
          `${keyBase}-r-${k++}`,
          emptyIfBlank(a.inner, `${keyBase}-rb${k}`, ctx),
          null,
          `\\sqrt{${a.inner}}`,
          radicalHeadroom(a.inner),

        ));
        i = a.end;
        continue;
      }
      // Unbalanced \sqrt — render an empty-slot placeholder inside a real radical.
      flush();
      out.push(connectedRadical(
        `${keyBase}-rb-${k++}`,
        emptySlotBox(ctx.slotCounter.n++, ctx, `${keyBase}-rsl${k}`),
        null,
        `\\sqrt{}`,
      ));
      i += 5;
      continue;
    }

    // ---- big operators: \sum, \prod, \int, \oint, \lim ----
    const bigMatch = /^\\(sum|prod|int|oint|lim)/.exec(src.slice(i));
    if (bigMatch) {
      const name = bigMatch[1];
      const after = i + name.length + 1;
      const bounds = readBigOpBounds(src, after);
      flush();
      const lowerNodes = bounds.lower !== undefined
        ? renderInner(bounds.lower, `${keyBase}-bl${k}`, ctx) : null;
      const upperNodes = bounds.upper !== undefined
        ? renderInner(bounds.upper, `${keyBase}-bu${k}`, ctx) : null;
      if (name === "sum") out.push(bigOperatorStack("∑", lowerNodes, upperNodes, `${keyBase}-sm-${k++}`));
      else if (name === "prod") out.push(bigOperatorStack("∏", lowerNodes, upperNodes, `${keyBase}-pr-${k++}`));
      else if (name === "oint") out.push(bigOperatorStack("∮", lowerNodes, upperNodes, `${keyBase}-oi-${k++}`));
      else if (name === "lim") {
        // lim text with underset
        out.push(createElement(
          "span",
          {
            key: `${keyBase}-lm-${k++}`,
            style: {
              display: "inline-flex", flexDirection: "column", alignItems: "center",
              verticalAlign: "baseline", lineHeight: 1, margin: "0 2px",
              transform: "translateY(-0.15em)",
            } as CSSProperties,
          },
          createElement("span", { key: "n", style: { fontStyle: "normal" } }, "lim"),
          createElement("span", {
            key: "u",
            style: { fontSize: "0.6em", marginTop: 1, minHeight: "0.7em" },
          }, lowerNodes ?? ""),
        ));
      } else {
        // \int — classic textbook: bounds as superscript/subscript next to the glyph.
        const intGlyph = createElement("span", {
          key: "g",
          style: { fontSize: "1.8em", lineHeight: 0.9, fontFamily: '"Cambria Math", "STIX Two Math", "Times New Roman", serif', display: "inline-block", verticalAlign: "middle", transform: "translateY(-0.05em)" },
        }, "∫");
        const bounds2 = createElement("span", {
          key: "b",
          style: { display: "inline-flex", flexDirection: "column", justifyContent: "center", fontSize: "0.6em", marginLeft: 1, lineHeight: 1 },
        },
          createElement("span", { key: "u", style: { minHeight: "0.7em" } }, upperNodes ?? ""),
          createElement("span", { key: "l", style: { minHeight: "0.7em", marginTop: 1 } }, lowerNodes ?? ""),
        );
        out.push(createElement("span", {
          key: `${keyBase}-in-${k++}`,
          style: { display: "inline-flex", alignItems: "center", verticalAlign: "middle", margin: "0 2px" },
        }, intGlyph, bounds2));
      }
      i = bounds.end;
      continue;
    }

    // ---- accents ----
    const accentMatch = /^\\(vec|hat|bar|tilde|dot|ddot)\{/.exec(src.slice(i));
    if (accentMatch) {
      const name = accentMatch[1];
      const a = readBraced(src, i + name.length + 1);
      if (a) {
        flush();
        const sym = name === "vec" ? "⃗" : name === "hat" ? "^" :
                    name === "bar" ? "‾" : name === "tilde" ? "~" :
                    name === "ddot" ? "··" : "·";
        const display = name === "vec" ? "→" : sym;
        out.push(accentSpan(display, renderInner(a.inner, `${keyBase}-ac${k}`, ctx), `${keyBase}-ac-${k++}`));
        i = a.end;
        continue;
      }
    }

    // ---- |abs|, ‖norm‖, floor, ceil ----
    const bracketMacro = /^\\(abs|norm|floor|ceil)\{/.exec(src.slice(i));
    if (bracketMacro) {
      const name = bracketMacro[1];
      const a = readBraced(src, i + name.length + 1);
      if (a) {
        flush();
        const [L, R] =
          name === "abs"   ? ["|", "|"] :
          name === "norm"  ? ["‖", "‖"] :
          name === "floor" ? ["⌊", "⌋"] :
                             ["⌈", "⌉"];
        out.push(createElement(
          "span",
          {
            key: `${keyBase}-br-${k++}`,
            style: { display: "inline-flex", alignItems: "baseline", verticalAlign: "baseline" },
          },
          createElement("span", { key: "L", style: { fontSize: "1.05em", padding: "0 1px" } }, L),
          createElement("span", { key: "B" }, renderInner(a.inner, `${keyBase}-brb${k}`, ctx)),
          createElement("span", { key: "R", style: { fontSize: "1.05em", padding: "0 1px" } }, R),
        ));
        i = a.end;
        continue;
      }
    }

    // ---- \begin{...} matrices & cases ----
    const beginMatch = /^\\begin\{(pmatrix|bmatrix|vmatrix|Vmatrix|matrix|cases)\}/.exec(src.slice(i));
    if (beginMatch) {
      const env = beginMatch[1];
      const startBody = i + beginMatch[0].length;
      const endTag = `\\end{${env}}`;
      const endIdx = src.indexOf(endTag, startBody);
      if (endIdx > 0) {
        const body = src.slice(startBody, endIdx);
        const rows = body.split(/\\\\/).map(r => r.trim()).filter(Boolean);
        const cells = rows.map(r =>
          r.split("&").map((c, ci) =>
            createElement("span", { key: `c${ci}` }, renderInner(c.trim(), `${keyBase}-mx${k}-${ci}`, ctx)),
          ),
        );
        flush();
        const [L, R] =
          env === "pmatrix" ? ["(", ")"] :
          env === "bmatrix" ? ["[", "]"] :
          env === "vmatrix" ? ["|", "|"] :
          env === "Vmatrix" ? ["‖", "‖"] :
          env === "cases"   ? ["{", ""] :
                              ["", ""];
        out.push(matrixSpan(cells, L, R, `${keyBase}-mx-${k++}`));
        i = endIdx + endTag.length;
        continue;
      }
    }

    // ---- superscript ----
    if (src[i] === "^") {
      const a = readBraced(src, i + 1);
      if (a) {
        flush();
        out.push(
          createElement(
            "sup",
            {
              key: `${keyBase}-s-${k++}`,
              "data-math-kind": "superscript",
              "data-math-src": `^{${a.inner}}`,
              style: {
                display: "inline-block",
                fontSize: "0.68em",
                lineHeight: 1,
                verticalAlign: "super",
                transform: "translateY(0.08em)",
                marginLeft: "1px",
              },
            },
            renderInner(a.inner, `${keyBase}-sb${k}`, ctx),
          ),
        );
        i = a.end;
        continue;
      }
    }

    // ---- subscript ----
    if (src[i] === "_") {
      const a = readBraced(src, i + 1);
      if (a) {
        flush();
        out.push(
          createElement(
            "sub",
            {
              key: `${keyBase}-sub-${k++}`,
              "data-math-kind": "subscript",
              "data-math-src": `_{${a.inner}}`,
              style: {
                display: "inline-block",
                fontSize: "0.68em",
                lineHeight: 1,
                verticalAlign: "sub",
                transform: "translateY(-0.04em)",
                marginLeft: "1px",
              },
            },
            renderInner(a.inner, `${keyBase}-sbb${k}`, ctx),
          ),
        );
        i = a.end;
        continue;
      }
    }

    // ---- plain `{...}` group (transparent grouping) ----
    if (src[i] === "{") {
      const a = readBraced(src, i);
      if (a) {
        flush();
        out.push(createElement("span", { key: `${keyBase}-g-${k++}` }, renderInner(a.inner, `${keyBase}-gb${k}`, ctx)));
        i = a.end;
        continue;
      }
    }

    buf += src[i];
    i++;
  }
  flush();
  return out;
}
