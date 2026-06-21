// Deterministic floating-number extractor for the Mathematics Smartboard.
// Ports the frontend extractor (src/lib/smartboard/floatingExtractor.ts) to
// the edge function, with strict-law overrides: fractions ALWAYS open to
// shell + numerator + denominator (no "simple-fraction stays whole" shortcut).
//
// Output chips follow these laws:
//   LAW 1 — NO SYNTHETIC SIGN. Leading "+" never invented.
//   LAW 2 — NO HIDDEN SIGN. Any container body containing a top-level
//           + − × ÷ is OPENED into shell + interior terms (recursively).
//   LAW 3 — STAY GLUED for short sign-free runs.
//   LAW 4 — LENGTH SPLIT for long sign-free runs (factor split).
//   LAW 5 — STRUCTURE CONTAINERS deduped to the canonical 10 kinds.

// (No toUnicodeMath import — see extractLine() for why we skip that pass.)

export type TermSign = "+" | "−" | "×" | "÷" | "=" | "±" | "<" | ">" | "≤" | "≥";

export type StructureKind =
  | "fraction" | "bracket" | "radical" | "power" | "log"
  | "integral" | "matrix" | "differential" | "abs" | "vector";

export interface FloatingTerm {
  sign: TermSign;
  body: string;
  display: string;
  synthetic?: boolean;
}

const PRETTY_SIGN: Record<TermSign, string> = {
  "+": "+", "−": "−", "×": "×", "÷": "÷",
  "=": "=", "±": "±",
  "<": "<", ">": ">", "≤": "≤", "≥": "≥",
};

const normaliseSign = (c: string): TermSign | null => {
  switch (c) {
    case "+": return "+";
    case "-": case "−": case "–": return "−";
    case "*": case "×": case "·": return "×";
    case "÷": return "÷";
    case "=": return "=";
    case "±": return "±";
    case "<": return "<";
    case ">": return ">";
    default: return null;
  }
};

const mkTerm = (sign: TermSign, body: string, synthetic = false): FloatingTerm => {
  const showSign = !(sign === "+" && synthetic);
  return {
    sign, body, synthetic,
    display: sign === "=" || sign === "±"
      ? PRETTY_SIGN[sign]
      : showSign ? `${PRETTY_SIGN[sign]}${body}` : body,
  };
};

const readGrouped = (src: string, start: number): { inner: string; end: number; open: string; close: string } | null => {
  const open = src[start];
  const close = open === "(" ? ")" : open === "[" ? "]" : open === "{" ? "}" : "";
  if (!close) return null;
  let depth = 1;
  let i = start + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === open) depth++;
    else if (src[i] === close) depth--;
    if (depth) i++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(start + 1, i), end: i + 1, open, close };
};

const readCommandName = (src: string, start: number): { name: string; end: number } | null => {
  if (src[start] !== "\\") return null;
  let i = start + 1;
  while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
  if (i === start + 1) return null;
  return { name: src.slice(start + 1, i), end: i };
};

const splitTopLevelTerms = (src: string): Array<{ sign: TermSign; body: string; synthetic: boolean }> => {
  const s = src.replace(/\s+/g, "");
  const out: Array<{ sign: TermSign; body: string; synthetic: boolean }> = [];
  let depth = 0;
  let last = 0;
  let pendingSign: TermSign = "+";
  let pendingSynthetic = true;

  const pushBody = (body: string) => {
    if (!body) return;
    out.push({ sign: pendingSign, body, synthetic: pendingSynthetic });
    pendingSign = "+";
    pendingSynthetic = true;
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      const cmd = readCommandName(s, i);
      if (cmd) { i = cmd.end - 1; continue; }
    }
    if (c === "(" || c === "[" || c === "{") { depth++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0) continue;
    if (c === "=") {
      pushBody(s.slice(last, i));
      out.push({ sign: "=", body: "", synthetic: false });
      last = i + 1;
      continue;
    }
    if (c === "±") {
      pushBody(s.slice(last, i));
      out.push({ sign: "±", body: "", synthetic: false });
      last = i + 1;
      continue;
    }
    const sig = normaliseSign(c);
    if (sig && (sig === "+" || sig === "−" || sig === "×" || sig === "÷")) {
      if (i === last) {
        pendingSign = sig;
        pendingSynthetic = false;
        last = i + 1;
        continue;
      }
      pushBody(s.slice(last, i));
      pendingSign = sig;
      pendingSynthetic = false;
      last = i + 1;
    }
  }
  pushBody(s.slice(last));
  return out;
};

const hasHiddenArithmetic = (src: string): boolean => {
  if (!src) return false;
  const s = src.replace(/\s+/g, "");
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") { depth++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0) continue;
    if (i === 0) continue;
    if (c === "+" || c === "-" || c === "−" || c === "–" ||
        c === "*" || c === "×" || c === "·" || c === "÷") return true;
  }
  return false;
};

const FACTOR_POWER_RE = /[²³⁴⁵⁶⁷⁸⁹⁰¹]|\^|_/;

const tokenizeImplicitFactors = (s: string): string[] => {
  if (!s) return [];
  const tokens: string[] = [];
  let i = 0;
  const consumeOptionalScript = (start: number): number => {
    let end = start;
    while (end < s.length && /[²³⁴⁵⁶⁷⁸⁹⁰¹]/.test(s[end])) end++;
    while (end < s.length && (s[end] === "^" || s[end] === "_")) {
      end++;
      if (s[end] === "{" || s[end] === "(") {
        const g = readGrouped(s, end);
        end = g ? g.end : end + 1;
      } else if (end < s.length) {
        end++;
      }
    }
    return end;
  };
  while (i < s.length) {
    const start = i;
    if (s[i] === "(" || s[i] === "[" || s[i] === "{") {
      const g = readGrouped(s, i);
      if (!g) return [s];
      let end = g.end;
      end = consumeOptionalScript(end);
      tokens.push(s.slice(start, end));
      i = end;
      continue;
    }
    if (/[0-9]/.test(s[i])) {
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      tokens.push(s.slice(start, i));
      continue;
    }
    const rest = s.slice(i);
    const fnMatch = rest.match(/^(sin|cos|tan|sec|csc|cot|ln|log)([₀₁₂₃₄₅₆₇₈₉]*|_\{[^}]+\}|_[a-zA-Z0-9])?/i);
    if (fnMatch) {
      let end = i + fnMatch[0].length;
      end = consumeOptionalScript(end);
      if (s[end] === "(" || s[end] === "{" || s[end] === "[") {
        const g = readGrouped(s, end);
        end = g ? g.end : end + 1;
      } else {
        while (end < s.length && /[0-9.]/.test(s[end])) end++;
        if (end < s.length && /[a-zA-Zθφπα-ω]/.test(s[end])) {
          end++;
          end = consumeOptionalScript(end);
        }
      }
      tokens.push(s.slice(start, end));
      i = end;
      continue;
    }
    if (/[a-zA-Zθφπα-ω]/.test(s[i])) {
      i++;
      i = consumeOptionalScript(i);
      tokens.push(s.slice(start, i));
      continue;
    }
    return [s];
  }
  // Merge leading numeric coefficient with the next factor group UNLESS the
  // next factor is a bracket whose interior hides an arithmetic sign.
  // Merge a leading numeric coefficient with the next factor group ONLY when
  // that next factor is NOT a bracket structure. Coefficients glue to
  // variables/functions (3·x² → 3x², 4·ac → 4ac) but never to a bracket
  // shell (3·(x+1) stays split so the bracket can open its interior).
  if (tokens.length >= 2 && /^[0-9]+(\.[0-9]+)?$/.test(tokens[0])) {
    const next = tokens[1];
    const nextIsBracket = /^[(\[{]/.test(next);
    if (!nextIsBracket) {
      tokens[0] = tokens[0] + tokens[1];
      tokens.splice(1, 1);
    }
  }
  return tokens;
};

const needsFactorSplit = (s: string): boolean => {
  if (!s) return false;
  const toks = tokenizeImplicitFactors(s);
  if (toks.length <= 1) return false;
  // Trigger when: any factor hides arithmetic OR any factor is a bracket
  // (which would otherwise smuggle a structural shell into the chip) OR
  // there are 3+ factors (length split per LAW 4).
  for (const t of toks) {
    if (hasHiddenArithmetic(t)) return true;
    if (/^[(\[{]/.test(t)) return true;
  }
  if (toks.length >= 3) return true;
  return false;
};

const readFractionBody = (src: string): { numerator: string; denominator: string } | null => {
  const frac = src.match(/^\\(?:d|t)?frac\{([\s\S]+)\}\{([\s\S]+)\}$/);
  if (frac) return { numerator: frac[1], denominator: frac[2] };
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === "/") {
      const numerator = src.slice(0, i);
      const denominator = src.slice(i + 1);
      if (numerator && denominator) return { numerator, denominator };
    }
  }
  return null;
};

const stripOuterParens = (s: string): string => {
  if ((s.startsWith("(") && s.endsWith(")")) || (s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    const g = readGrouped(s, 0);
    if (g && g.end === s.length) return g.inner;
  }
  return s;
};

const readSqrtBody = (src: string): { index: string; radicand: string } | null => {
  if (src.startsWith("\\sqrt")) {
    let p = 5;
    let index = "";
    if (src[p] === "[") {
      const close = src.indexOf("]", p + 1);
      if (close > 0) { index = src.slice(p + 1, close); p = close + 1; }
    }
    const group = src[p] ? readGrouped(src, p) : null;
    if (group && group.end === src.length) return { index, radicand: group.inner };
  }
  if (src.startsWith("√")) {
    return { index: "", radicand: stripOuterParens(src.slice(1)) };
  }
  // Unicode-superscript indexed roots: ³√(...), ⁿ√(...).
  const idxMatch = src.match(/^([²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁰¹])√(.*)$/);
  if (idxMatch) {
    const supMap: Record<string, string> = {
      "²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁰":"0","¹":"1","ⁿ":"n","ⁱ":"i",
    };
    return { index: supMap[idxMatch[1]] ?? idxMatch[1], radicand: stripOuterParens(idxMatch[2]) };
  }
  return null;
};

const readFunctionBody = (src: string): { shell: string; arg: string } | null => {
  const latexLog = src.match(/^\\log_\{([^{}]+)\}(.*)$/);
  if (latexLog) {
    const arg = latexLog[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `log_${latexLog[1]}()`, arg: grp.inner };
    if (arg) return { shell: `log_${latexLog[1]}()`, arg };
  }
  const asciiLog = src.match(/^log_(?:\{([^{}]+)\}|([a-zA-Z0-9]))(.*)$/);
  if (asciiLog) {
    const sub = asciiLog[1] ?? asciiLog[2];
    const arg = asciiLog[3];
    const grp = arg && (arg[0] === "(" || arg[0] === "{") ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `log_${sub}()`, arg: grp.inner };
    if (arg) return { shell: `log_${sub}()`, arg };
  }
  const uniLog = src.match(/^(log[₀₁₂₃₄₅₆₇₈₉]+)(.*)$/);
  if (uniLog) {
    const arg = uniLog[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `${uniLog[1]}()`, arg: grp.inner };
    if (arg) return { shell: `${uniLog[1]}()`, arg };
  }
  const fn = src.match(/^(sin|cos|tan|ln|log)(.*)$/i);
  if (!fn) return null;
  const arg = fn[2];
  if (!arg) return null;
  const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
  if (grp && grp.end === arg.length) return { shell: `${fn[1]}()`, arg: grp.inner };
  return { shell: `${fn[1]}`, arg };
};

const readBracketPower = (src: string): { shell: string; inner: string; exponent?: string } | null => {
  if (!(src.startsWith("(") || src.startsWith("[") || src.startsWith("{"))) return null;
  const grp = readGrouped(src, 0);
  if (!grp) return null;
  const tail = src.slice(grp.end);
  if (!tail) return { shell: `${grp.open}${grp.close}`, inner: grp.inner };
  if (tail.startsWith("^") && tail.length > 1) {
    const expGroup = tail[1] === "{" || tail[1] === "(" ? readGrouped(tail, 1) : null;
    const exponent = expGroup ? expGroup.inner : tail.slice(1);
    if (expGroup ? expGroup.end === tail.length : true) {
      const expoSimple = exponent && !hasHiddenArithmetic(exponent);
      return {
        shell: expoSimple ? `${grp.open}${grp.close}${tail}` : `${grp.open}${grp.close}^()`,
        inner: grp.inner,
        exponent,
      };
    }
  }
  // Unicode-superscript exponent on a bracket: (...)² etc.
  const uniSup = tail.match(/^([²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ]+)$/);
  if (uniSup) {
    return { shell: `${grp.open}${grp.close}${uniSup[1]}`, inner: grp.inner };
  }
  return null;
};

const readIntegralBody = (src: string): { shell: string; body: string } | null => {
  const trimmed = src.replace(/\\int/g, "∫");
  if (!trimmed.startsWith("∫")) return null;
  // Optional sub/superscripts on the ∫ (definite integrals). Consume them
  // greedily into the shell head so the shell renders as ∫_a^b()dx.
  const dx = trimmed.match(/^(.*?)(d[a-zA-Z])$/);
  if (!dx) return null;
  const full = dx[1];
  const diff = dx[2];
  let i = 1;
  // Skip over sub/sup tokens immediately after ∫ until we hit the integrand.
  while (i < full.length && !(/[A-Za-z0-9√(\\]/.test(full[i]))) i++;
  const head = full.slice(0, i);
  const body = full.slice(i);
  if (!body) return null;
  return { shell: `∫${head}()${diff}`, body };
};

const readDerivativeBody = (src: string): { shell: string; body: string } | null => {
  const latex = src.match(/^\\frac\{d\}\{d([a-zA-Z]+)\}(.*)$/);
  if (latex) {
    const arg = latex[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `d/d${latex[1]}()`, body: grp.inner };
    if (arg) return { shell: `d/d${latex[1]}()`, body: arg };
  }
  const uni = src.match(/^d\/d([a-zA-Z]+)(.*)$/);
  if (uni) {
    const arg = uni[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `d/d${uni[1]}()`, body: grp.inner };
    if (arg) return { shell: `d/d${uni[1]}()`, body: arg };
  }
  return null;
};

const emitSegmentTerms = (
  out: FloatingTerm[],
  sign: TermSign,
  body: string,
  synthetic: boolean,
): void => {
  if (!body) return;

  // Drill INTO integrals first so ∫(a+b)dx becomes shell + a + b chips
  // instead of one giant chip with hidden + signs.
  const integral = readIntegralBody(body);
  if (integral) {
    out.push(mkTerm(sign, integral.shell, synthetic));
    // Strip the outer parens around the integrand so we don't add a
    // redundant "()" container chip.
    out.push(...extractTermsFromAscii(stripOuterParens(integral.body)));
    return;
  }

  const deriv = readDerivativeBody(body);
  if (deriv) {
    out.push(mkTerm(sign, deriv.shell, synthetic));
    out.push(...extractTermsFromAscii(stripOuterParens(deriv.body)));
    return;
  }

  const bracketPow = readBracketPower(body);
  if (bracketPow) {
    out.push(mkTerm(sign, bracketPow.shell, synthetic));
    out.push(...extractTermsFromAscii(bracketPow.inner));
    if (bracketPow.exponent && hasHiddenArithmetic(bracketPow.exponent)) {
      out.push(...extractTermsFromAscii(bracketPow.exponent));
    }
    return;
  }



  const frac = readFractionBody(body);
  if (frac) {
    // Strict rule: ALWAYS open fractions to shell + numerator + denominator.
    // Strip outer parens off numerator/denominator (they belong to the
    // fraction's structural grouping, not to a content bracket).
    out.push(mkTerm(sign, "□/□", synthetic));
    out.push(...extractTermsFromAscii(stripOuterParens(frac.numerator)));
    out.push(...extractTermsFromAscii(stripOuterParens(frac.denominator)));
    return;
  }


  const sqrt = readSqrtBody(body);
  if (sqrt) {
    const simpleRadicand =
      !hasHiddenArithmetic(sqrt.radicand) &&
      !readFractionBody(sqrt.radicand) &&
      !needsFactorSplit(sqrt.radicand);
    if (simpleRadicand) {
      const prefix = sqrt.index ? `√[${sqrt.index}]` : "√";
      out.push(mkTerm(sign, `${prefix}${sqrt.radicand}`, synthetic));
    } else {
      const prefix = sqrt.index ? `√[${sqrt.index}]()` : "√()";
      out.push(mkTerm(sign, prefix, synthetic));
      out.push(...extractTermsFromAscii(sqrt.radicand));
    }
    return;
  }

  const fn = readFunctionBody(body);
  if (fn) {
    const simpleArg = !hasHiddenArithmetic(fn.arg) && !readFractionBody(fn.arg) && !needsFactorSplit(fn.arg);
    if (simpleArg) {
      const compactShell = fn.shell.endsWith("()") ? fn.shell.slice(0, -2) : fn.shell;
      // Keep parentheses for subscripted logs so the subscript can't visually
      // fuse with the argument (covers ASCII "log_a", Unicode "log₂", etc.).
      const hasSubscript = /[₀₁₂₃₄₅₆₇₈₉_]/.test(compactShell);
      const arg = hasSubscript && fn.arg.length > 1 ? `(${fn.arg})` : fn.arg;
      out.push(mkTerm(sign, `${compactShell}${arg}`, synthetic));
    } else {
      out.push(mkTerm(sign, fn.shell, synthetic));
      out.push(...extractTermsFromAscii(fn.arg));
    }
    return;
  }

  if (needsFactorSplit(body)) {
    const toks = tokenizeImplicitFactors(body);
    if (toks.length > 1) {
      for (let k = 0; k < toks.length; k++) {
        emitSegmentTerms(out, k === 0 ? sign : "+", toks[k], k === 0 ? synthetic : true);
      }
      return;
    }
  }

  out.push(mkTerm(sign, body, synthetic));
};

export const extractTermsFromAscii = (src: string): FloatingTerm[] => {
  if (!src) return [];
  const s = src
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/–|—/g, "-");

  const out: FloatingTerm[] = [];
  for (const part of splitTopLevelTerms(s)) {
    if (part.sign === "=" || part.sign === "±") {
      out.push(mkTerm(part.sign, ""));
      continue;
    }
    emitSegmentTerms(out, part.sign, part.body, part.synthetic);
  }
  return out;
};

const STRUCT_PATTERNS: Array<{ kind: StructureKind; rx: RegExp }> = [
  { kind: "fraction", rx: /\\(?:d|t)?frac\b|\/|□\/□/i },
  { kind: "radical",  rx: /\\sqrt\b|√/i },
  { kind: "log",      rx: /\\log_|log[₀₁₂₃₄₅₆₇₈₉_]/i },
  { kind: "integral", rx: /\\int\b|∫/i },
  { kind: "matrix",   rx: /\\begin\{[bp]?matrix\}/i },
  { kind: "differential", rx: /\\frac\{d\}\{d|\\partial|d\/d[a-zA-Z]/ },
  { kind: "power",    rx: /[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ]|\^/ },
  { kind: "bracket",  rx: /[\(\[]/ },
  { kind: "abs",      rx: /\|[^|]+\|/ },
  { kind: "vector",   rx: /⟨[^⟩]+⟩/ },
];

export const detectContainers = (src: string): StructureKind[] => {
  if (!src) return [];
  const out: StructureKind[] = [];
  const seen = new Set<StructureKind>();
  for (const { kind, rx } of STRUCT_PATTERNS) {
    if (rx.test(src) && !seen.has(kind)) { seen.add(kind); out.push(kind); }
  }
  return out;
};

/** Convert a stream of FloatingTerm into final chip strings (Unicode), with
 *  contextual leading-"+" suppression for first chip and chips after = / ±. */
export const termsToChips = (terms: FloatingTerm[]): string[] => {
  const out: string[] = [];
  let seenContent = false;
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    if (t.sign === "=" || t.sign === "±") {
      out.push(PRETTY_SIGN[t.sign]);
      seenContent = false;
      continue;
    }
    const isFirst = !seenContent;
    if (t.sign === "+" && (t.synthetic || isFirst)) {
      out.push(t.body);
    } else if (t.sign === "+") {
      out.push(`+${t.body}`);
    } else {
      out.push(`${PRETTY_SIGN[t.sign]}${t.body}`);
    }
    seenContent = true;
  }
  return out;
};

export interface ExtractedLine {
  equation: string;
  fillers: string[];
  containers: StructureKind[];
}

/** Run the full deterministic extraction on a single equation line.
 *  Returns Unicode chips ready for the UI. */
export const extractLine = (rawEquation: string): ExtractedLine => {
  const equation = String(rawEquation ?? "").trim();
  if (!equation) return { equation, fillers: [], containers: [] };
  // Do NOT pre-process via toUnicodeMath — that folds "^(n−4)" into Unicode
  // superscripts and destroys the bracket structure the chip splitter needs.
  const terms = extractTermsFromAscii(equation);
  const fillers = termsToChips(terms).filter((c) => c.length > 0);
  const containers = detectContainers(equation);
  return { equation, fillers, containers };
};

/** Split a multi-line solution string into per-line equations.
 *  Drops blank lines and lines that look like prose only. */
export const splitSolutionLines = (solution: string): string[] => {
  if (!solution) return [];
  return solution
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
};
