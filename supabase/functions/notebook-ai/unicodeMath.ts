// Shared Unicode-math normalizer. Converts LaTeX/code syntax (\sqrt, ^{},
// \log_, *, \pm, ...) into classroom Unicode (√, ², log₂, ×, ±, ...).
// Used by the floating-number extractor on both server and client so chips
// never display raw `\sqrt`, `^{2}`, `**`, etc.

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "(": "₍", ")": "₎",
};

const toSup = (s: string) => s.split("").map((c) => SUP[c] ?? c).join("");
const toSub = (s: string) => s.split("").map((c) => SUB[c] ?? c).join("");
const canSup = (s: string) => s.split("").every((c) => SUP[c] !== undefined);
const canSub = (s: string) => s.split("").every((c) => SUB[c] !== undefined);

/* ── fraction protection ───────────────────────────────────────────────
 * `\frac{a}{b}` is a STRUCTURE. Brace-stripping passes below would turn it
 * into `\frac ab`, which renders as an empty fraction shell PLUS loose
 * leftover placeholders. Lift complete fractions out first, restore last. */

const FRAC_TOKEN = (i: number) => `\uE002${String.fromCharCode(0xE200 + i)}\uE002`;

const matchBrace = (s: string, i: number): number => {
  if (s[i] !== "{") return -1;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
};

const holdFractions = (src: string, holds: string[]): string => {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const m = /^\\(?:d|t)?frac\s*(?=\{)/.exec(src.slice(i));
    if (!m) { out += src[i++]; continue; }
    const aStart = i + m[0].length;
    const aEnd = matchBrace(src, aStart);
    const bEnd = aEnd > 0 ? matchBrace(src, aEnd) : -1;
    if (aEnd < 0 || bEnd < 0) { out += src[i++]; continue; }
    const num = src.slice(aStart + 1, aEnd - 1);
    const den = src.slice(aEnd + 1, bEnd - 1);
    out += FRAC_TOKEN(holds.length);
    holds.push("");
    const at = holds.length - 1;
    holds[at] = `\\frac{${toUnicodeMath(num)}}{${toUnicodeMath(den)}}`;
    i = bEnd;
  }
  return out;
};


/** Convert any LaTeX / code-flavored math to Unicode classroom math. */
export const toUnicodeMath = (input: string): string => {
  if (!input) return "";
  let s = String(input);

  // Preserve empty power slots as structural superscripts. If we let the
  // generic power converter touch `u^{□}`, it becomes inline `u□`, which reads
  // like multiplication instead of “u raised to an empty exponent box”.
  const POWER_SLOT = "\uE000POWER_SLOT\uE000";
  const scriptSlots: string[] = [];
  const holdScript = (markup: string) => {
    const token = `\uE001SCRIPT_${scriptSlots.length}\uE001`;
    scriptSlots.push(markup);
    return token;
  };
  s = s.replace(/\^\{\s*□\s*\}/g, POWER_SLOT);

  const fracHolds: string[] = [];
  s = holdFractions(s, fracHolds);

  // Strip KaTeX-style $...$ / $$...$$ delimiters.
  s = s.replace(/\$+/g, "");

  // \sqrt
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, x) => `√(${x})`);
  s = s.replace(/\\sqrt\s*([A-Za-z0-9])/g, (_m, x) => `√${x}`);
  s = s.replace(/\\sqrt\b/g, "√");
  s = s.replace(/\\root\b/g, "√");
  s = s.replace(/\bsqrt\s*\(([^()]*)\)/gi, (_m, x) => `√(${x})`);
  s = s.replace(/\bsqrt\b/gi, "√");
  // collapse √(N) where N is a single atom → √N
  s = s.replace(/√\(([A-Za-z0-9]+)\)/g, (_m, x) => `√${x}`);

  // Leave \frac{a}{b} intact — the notebook renderer draws a real stacked
  // fraction from it. Collapsing to "(a)/(b)" produces a slash render
  // which is pedagogically wrong (it reads as (a/b)·…). Compound fillers
  // containing \frac are filtered out by isStillDirty.
  s = s.replace(/\\(?:d|t)?frac\b(?!\s*\{)/g, "□/□");

  // log subscripts
  s = s.replace(/\\log_\s*\{([^{}]+)\}/g, (_m, x) => `log${toSub(x)}`);
  s = s.replace(/\\log_\s*([0-9])/g, (_m, x) => `log${toSub(x)}`);
  s = s.replace(/\\log\b/g, "log");
  s = s.replace(/\\ln\b/g, "ln");

  // Generic subscript _{...} or _N
  s = s.replace(/_\{([^{}]+)\}/g, (_m, x) => canSub(x) ? toSub(x) : holdScript(`_{${x}}`));
  s = s.replace(/_([0-9A-Za-z+\-()])/g, (_m, x) => canSub(x) ? toSub(x) : holdScript(`_{${x}}`));

  // Powers ^{...}, ^N, **N
  s = s.replace(/\^\{([^{}]+)\}/g, (_m, x) => canSup(x) ? toSup(x) : holdScript(`^{${x}}`));
  s = s.replace(/\^([0-9A-Za-z+\-()])/g, (_m, x) => canSup(x) ? toSup(x) : holdScript(`^{${x}}`));
  s = s.replace(/\*\*([0-9A-Za-z]+)/g, (_m, x) => canSup(x) ? toSup(x) : holdScript(`^{${x}}`));

  // operators / symbols
  s = s.replace(/\\cdot|\\times/g, "×");
  s = s.replace(/(?<![A-Za-z0-9])\*(?!\*)/g, "×");
  s = s.replace(/\\div/g, "÷");
  s = s.replace(/\\pm/g, "±").replace(/\\mp/g, "∓");
  s = s.replace(/\\leq/g, "≤").replace(/\\geq/g, "≥");
  s = s.replace(/\\neq/g, "≠").replace(/\\approx/g, "≈");
  s = s.replace(/\\infty/g, "∞");
  s = s.replace(/\\pi/g, "π").replace(/\\theta/g, "θ");
  s = s.replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\gamma/g, "γ");

  // Spacing macros / stray escapes
  s = s.replace(/\\left\b|\\right\b/g, "");
  s = s.replace(/\\[,!;: ]/g, " ");
  s = s.replace(/\\\\/g, " ");
  s = s.replace(/\\(?=[√πθαβγ])/g, "");
  s = s.replace(/\\(?=[()[\]{}+\-−=×÷*/])/g, "");

  // Hyphen → proper minus when between math atoms
  s = s.replace(/([0-9A-Za-z\)\]√π])\s*-\s*(?=[0-9A-Za-z\(\[√π])/g, "$1−");
  if (s.startsWith("-")) s = "−" + s.slice(1);

  // Strip stray braces left behind
  s = s.replace(/[{}]/g, "");

  scriptSlots.forEach((markup, i) => {
    s = s.replace(`\uE001SCRIPT_${i}\uE001`, markup);
  });
  s = s.replace(new RegExp(POWER_SLOT, "g"), "^{□}");

  return s.trim();
};

/** Returns true if any forbidden code-syntax substring is still present. */
export const isStillDirty = (s: string): boolean => {
  if (!s) return false;
  if (/\\[A-Za-z]+/.test(s)) return true;     // any \word
  if (/\\$/.test(s)) return true;             // trailing backslash
  const withoutAllowedSlots = s
    .replace(/\^\{\s*□\s*\}/g, "")
    .replace(/\^\{[^{}]+\}/g, "")
    .replace(/_\{[^{}]+\}/g, "");
  if (/\^\{|_\{/.test(withoutAllowedSlots)) return true; // ^{...} or _{...}, except empty superscript slots
  if (/\bsqrt\s*\(/i.test(s)) return true;    // sqrt(
  if (/\*\*/.test(s)) return true;            // **
  return false;
};
