// Manual floating-chip promoter.
//
// When the teacher highlights a span of text on the Floating Preparation
// page and presses Enter, this function decides whether to attach a
// structural empty-bracket shell (□) to the highlighted atom based on what
// immediately surrounds the highlight on the SAME source line.
//
// Pure, side-effect free, fully unit-testable. See
// src/test/manualFloatingPromoter.test.ts for the rule table.

export type AttachedShell =
  | "power"
  | "subscript"
  | "log"
  | "function"
  | "bracket"
  | "radical"
  | "derivative"
  | "integral"
  | "absolute"
  | "limit";

/** Subset of FloatingLine ContainerKind that the promoter may attach. */
export type PromoterContainer =
  | "fraction" | "bracket" | "radical" | "power" | "log"
  | "integral" | "matrix" | "differential" | "abs" | "vector";

const SHELL_TO_CONTAINER: Record<AttachedShell, PromoterContainer | null> = {
  power: "power",
  subscript: null,
  log: "log",
  function: "bracket",
  bracket: "bracket",
  radical: "radical",
  derivative: "differential",
  integral: "integral",
  absolute: "abs",
  limit: null,
};

export interface PromoteResult {
  /** Markup that becomes the floating chip equation. */
  payload: string;
  /** Which structural shell was auto-attached, if any. */
  shell?: AttachedShell;
  /** Container kind that should be added to the line's symbols row, if any. */
  container?: PromoterContainer;
  /** Toast-friendly description of what happened. */
  label: string;
}


const TRIG_FUNCS = ["sin", "cos", "tan", "csc", "sec", "cot", "sinh", "cosh", "tanh"];
const LOG_FUNCS = ["log", "ln", "lg", "exp"];

/** True when `s` already contains its own visible exponent (^…). */
const hasOwnPower = (s: string) => /\^/.test(s);
const hasOwnSubscript = (s: string) => /_/.test(s);
const hasOwnBracket = (s: string) => /\(/.test(s) && /\)/.test(s);

/**
 * Decide the floating chip for a teacher highlight.
 *
 * @param selection  text the teacher highlighted (already trimmed)
 * @param lineBefore source-line characters appearing BEFORE the highlight on
 *                   the same line (may be empty)
 * @param lineAfter  source-line characters appearing AFTER the highlight on
 *                   the same line (may be empty)
 */
export function promoteSelection(
  selection: string,
  lineBefore: string,
  lineAfter: string,
): PromoteResult {
  const sel = (selection ?? "").trim();
  if (!sel) return { payload: "", label: "Empty selection" };

  const after = (lineAfter ?? "").replace(/^\s+/, "");
  const before = (lineBefore ?? "").replace(/\s+$/, "");

  // ── Operator-only highlights that always carry a body shell ────────────
  if (sel === "√" || sel === "\\sqrt") {
    return { payload: "√(□)", shell: "radical", label: "Added with √(□) shell" };
  }
  if (sel === "∫" || sel === "\\int") {
    return { payload: "∫□ d□", shell: "integral", label: "Added with ∫□ d□ shell" };
  }
  if (/^(d\/d[a-zA-Z]|∂\/∂[a-zA-Z])$/.test(sel)) {
    return { payload: `${sel}(□)`, shell: "derivative", label: "Added with (□) operand" };
  }
  if (sel === "lim") {
    return { payload: "lim_{□}(□)", shell: "limit", label: "Added with lim_{□}(□) shell" };
  }

  // ── log / ln family: subscript + bracket awareness ─────────────────────
  if (LOG_FUNCS.includes(sel)) {
    const wantsSub = after.startsWith("_") && !hasOwnSubscript(sel);
    const wantsBracket = (after.startsWith("(") || /^_/.test(after)) && !hasOwnBracket(sel);
    if (wantsSub && wantsBracket) {
      return { payload: `${sel}_{□}(□)`, shell: "log", label: `Added with ${sel}_{□}(□) shell` };
    }
    if (wantsSub) {
      return { payload: `${sel}_{□}`, shell: "subscript", label: `Added with ${sel}_{□} shell` };
    }
    if (after.startsWith("(") || /^[a-zA-Z0-9]/.test(after)) {
      return { payload: `${sel}(□)`, shell: "function", label: `Added with ${sel}(□) shell` };
    }
    return { payload: `${sel}(□)`, shell: "function", label: `Added with ${sel}(□) shell` };
  }

  // ── trig family ────────────────────────────────────────────────────────
  if (TRIG_FUNCS.includes(sel)) {
    if (after.startsWith("^") && !hasOwnPower(sel)) {
      // sin² etc — power AND argument
      return { payload: `${sel}^{□}(□)`, shell: "power", label: `Added with ${sel}^{□}(□) shell` };
    }
    return { payload: `${sel}(□)`, shell: "function", label: `Added with ${sel}(□) shell` };
  }

  // ── Absolute value: highlight flanked by | on both sides ───────────────
  if (before.endsWith("|") && after.startsWith("|")) {
    return { payload: `|${sel}|`, shell: "absolute", label: "Added with |□| shell" };
  }

  // ── Generic atom: look at the very next non-space character ────────────
  if (after.startsWith("^") && !hasOwnPower(sel)) {
    return { payload: `${sel}^{□}`, shell: "power", label: `Added with ${sel}^{□} shell` };
  }
  if (after.startsWith("_") && !hasOwnSubscript(sel)) {
    return { payload: `${sel}_{□}`, shell: "subscript", label: `Added with ${sel}_{□} shell` };
  }
  if (after.startsWith("(") && !hasOwnBracket(sel)) {
    // Treat any preceding atom as a function/coefficient that owns the bracket.
    // (f(x), θ(x+2y), 2(x+1)…)
    return { payload: `${sel}(□)`, shell: "bracket", label: `Added with ${sel}(□) shell` };
  }

  // No structural attachment — chip is exactly the highlighted text.
  return { payload: sel, label: "Added as floating chip" };
}
