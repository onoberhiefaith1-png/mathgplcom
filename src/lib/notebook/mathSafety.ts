// Lightweight sanity check for LaTeX produced by friendlyToLatex.
// Rejects strings that would scatter into placeholders / orphan braces
// inside the renderer. Used by MathInline / MathBlock to refuse a commit
// that would visibly mangle a previously-rendered equation.

export function isSafeLatex(s: string): boolean {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;

  // Balanced { } and ( ).
  let curly = 0, paren = 0;
  for (const ch of t) {
    if (ch === "{") curly++;
    else if (ch === "}") { curly--; if (curly < 0) return false; }
    else if (ch === "(") paren++;
    else if (ch === ")") { paren--; if (paren < 0) return false; }
  }
  if (curly !== 0 || paren !== 0) return false;

  // No trailing backslash command without a body, e.g. `\frac` / `\sqrt` alone.
  if (/\\(frac|sqrt|left|right)\s*$/.test(t)) return false;

  // Reject results that are only structural debris (just braces / operators / spaces).
  if (!/[A-Za-z0-9π∞√∑∫]/.test(t)) return false;

  return true;
}
