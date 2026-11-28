// Fractional and nested exponents.
//
// The classroom renderer draws a superscript only from `^{...}`. Models, pastes
// and older notes also write `^\frac{3}{2}`, `^{3/2}`, `^(3/2)` and `\frac12`.
// Those forms either drop the caret or paint `\frac` as text. This module
// rewrites them into one braced superscript, and, when a structure still cannot
// be drawn, into readable plain mathematics such as 50^(3/2).

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

const matchParen = (s: string, i: number): number => {
  if (s[i] !== "(") return -1;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")") {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
};

/** A complete `\frac` / `\dfrac` / `\tfrac`, including the TeX shorthand `\frac12`. */
const readFracAt = (s: string, i: number): { num: string; den: string; end: number } | null => {
  const cmd = /^(?:\\dfrac|\\tfrac|\\frac)/.exec(s.slice(i));
  if (!cmd) return null;
  let p = i + cmd[0].length;
  const readArg = (): string | null => {
    while (s[p] === " ") p++;
    if (s[p] === "{") {
      const end = matchBrace(s, p);
      if (end < 0) return null;
      const inner = s.slice(p + 1, end - 1);
      p = end;
      return inner;
    }
    if (s[p] === "\\") {
      const name = /^\\[A-Za-z]+/.exec(s.slice(p));
      if (!name) return null;
      const start = p;
      p += name[0].length;
      return s.slice(start, p);
    }
    if (p < s.length && /[0-9A-Za-z]/.test(s[p])) {
      const ch = s[p];
      p += 1;
      return ch;
    }
    return null;
  };
  const num = readArg();
  const den = num === null ? null : readArg();
  if (num === null || den === null) return null;
  return { num, den, end: p };
};

const slashFraction = (inner: string): { num: string; den: string } | null => {
  const t = inner.trim();
  const m = t.match(/^((?:\\[A-Za-z]+(?:\{[^{}]*\})*)|(?:√?(?:[0-9]+(?:\.[0-9]+)?|[A-Za-z])))\/((?:\\[A-Za-z]+(?:\{[^{}]*\})*)|(?:√?(?:[0-9]+(?:\.[0-9]+)?|[A-Za-z])))$/);
  if (!m) return null;
  return { num: m[1], den: m[2] };
};

const FRAC = "\\\\(?:d|t)?frac\\{[^{}]*\\}\\{[^{}]*\\}";

/** Restore powers whose caret was lost when a line was split into tokens.
 *  `50 \frac{3}{4}` and `\sqrt 50 \frac{3}{2}` are powers. A single-digit
 *  mixed number `2\frac{1}{2}` is left as a mixed number. */
export const rejoinDroppedPowers = (input: string): string => {
  let s = String(input ?? "");
  s = s.replace(/\\sqrt(?!\s*[\[{])\s*([A-Za-z0-9]+)/g, "\\sqrt{$1}");
  s = s.replace(new RegExp(`\\\\sqrt\\{([^{}]+)\\}\\s*(${FRAC})`, "g"), "\\sqrt{$1^{$2}}");
  s = s.replace(new RegExp(`([0-9]{2,}|[A-Za-z]|\\))\\s+(${FRAC})`, "g"), "$1^{$2}");
  s = s.replace(new RegExp(`([0-9]{2,})(${FRAC})`, "g"), "$1^{$2}");
  s = s.replace(new RegExp(`\\)\\s*(${FRAC})`, "g"), ")^{$2}");
  return s;
};

/** Rewrite every exponent into `^{...}`, with a fractional exponent as `\frac`. */
export const normaliseExponentSyntax = (input: string): string => {
  const s = rejoinDroppedPowers(String(input ?? ""));
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && /^\\(?:d|t)?frac/.test(s.slice(i))) {
      const frac = readFracAt(s, i);
      if (frac) {
        const num = normaliseExponentSyntax(frac.num);
        const den = normaliseExponentSyntax(frac.den);
        out += `\\frac{${num}}{${den}}`;
        i = frac.end;
        continue;
      }
    }
    if (s[i] === "^") {
      let p = i + 1;
      while (s[p] === " ") p++;
      let inner = "";
      let end = p;
      if (s[p] === "{") {
        const close = matchBrace(s, p);
        if (close > 0) {
          inner = s.slice(p + 1, close - 1);
          end = close;
        }
      } else if (s[p] === "(") {
        const close = matchParen(s, p);
        if (close > 0) {
          inner = s.slice(p + 1, close - 1);
          end = close;
        }
      } else if (s[p] === "\\") {
        const frac = readFracAt(s, p);
        if (frac) {
          inner = s.slice(p, frac.end);
          end = frac.end;
        }
      } else if (p < s.length && /[0-9A-Za-z+\-−]/.test(s[p])) {
        inner = s[p];
        end = p + 1;
      }
      if (end === p) {
        out += s[i];
        i += 1;
        continue;
      }
      let body = normaliseExponentSyntax(inner.trim());
      const slash = slashFraction(body);
      if (slash) body = `\\frac{${normaliseExponentSyntax(slash.num)}}{${normaliseExponentSyntax(slash.den)}}`;
      out += `^{${body}}`;
      i = end;
      continue;
    }
    out += s[i];
    i += 1;
  }
  return out;
};

const plainPiece = (part: string): string => (/^[0-9A-Za-z.]+$/.test(part) ? part : `(${part})`);

/** Last resort when a backslash command would otherwise be painted as text. */
export const readableMathFallback = (input: string): string => {
  const s = normaliseExponentSyntax(input);
  const convert = (src: string): string => {
    let out = "";
    let i = 0;
    while (i < src.length) {
      const frac = readFracAt(src, i);
      if (frac && src[i] === "\\") {
        out += `${plainPiece(convert(frac.num))}/${plainPiece(convert(frac.den))}`;
        i = frac.end;
        continue;
      }
      if (src.startsWith("\\sqrt", i)) {
        let p = i + 5;
        let degree = "";
        if (src[p] === "[") {
          const close = src.indexOf("]", p + 1);
          if (close > 0) {
            degree = src.slice(p + 1, close);
            p = close + 1;
          }
        }
        if (src[p] === "{") {
          const end = matchBrace(src, p);
          if (end > 0) {
            const body = convert(src.slice(p + 1, end - 1));
            out += degree ? `(${body})^(1/${degree})` : `√(${body})`;
            i = end;
            continue;
          }
        }
      }
      if ((src[i] === "^" || src[i] === "_") && src[i + 1] === "{") {
        const end = matchBrace(src, i + 1);
        if (end > 0) {
          const mark = src[i] === "^" ? "^" : "_";
          out += `${mark}(${convert(src.slice(i + 2, end - 1))})`;
          i = end;
          continue;
        }
      }
      if (src.startsWith("\\times", i) || src.startsWith("\\cdot", i)) {
        out += "×";
        i += src.startsWith("\\times", i) ? 6 : 5;
        continue;
      }
      if (src.startsWith("\\div", i)) { out += "÷"; i += 4; continue; }
      if (src.startsWith("\\pm", i)) { out += "±"; i += 3; continue; }
      out += src[i];
      i += 1;
    }
    return out;
  };
  return convert(s).replace(/\\([A-Za-z]+)/g, "$1");
};
