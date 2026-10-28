// BIDMAS / Order of Operations engine.
// Tokenizing, parsing, evaluating, comparing, hint generation.

export type BidmasDifficulty = "easy" | "medium" | "hard" | "expert";

export type Sym = string; // single-char per tile: 0-9, +, -, ×, ÷, (, ), ^, ²

export type TokenKind = "num" | "op" | "lpar" | "rpar";
export interface Token {
  kind: TokenKind;
  text: string;     // "23", "+", "(", ")"
  value?: number;   // for num
  op?: "+" | "-" | "×" | "÷" | "^";
  /** Source tile column indices that contributed (for reward collection). */
  cols: number[];
}

const OPS = new Set(["+", "-", "×", "÷", "^"]);

/* ============== TOKENIZE ============== */
export const tokenizeRow = (cells: (string | null)[]): { tokens: Token[]; usedCols: number[] } | { error: string } => {
  const tokens: Token[] = [];
  const usedCols: number[] = [];
  let i = 0;
  while (i < cells.length) {
    const c = cells[i];
    if (c == null || c === "") { i++; continue; }
    if (/[0-9]/.test(c)) {
      let txt = "";
      const cols: number[] = [];
      while (i < cells.length && cells[i] != null && /[0-9]/.test(cells[i] as string)) {
        txt += cells[i];
        cols.push(i);
        i++;
      }
      // optional decimal
      if (i < cells.length && cells[i] === ".") {
        txt += ".";
        cols.push(i);
        i++;
        while (i < cells.length && cells[i] != null && /[0-9]/.test(cells[i] as string)) {
          txt += cells[i];
          cols.push(i);
          i++;
        }
      }
      const v = Number(txt);
      if (!Number.isFinite(v)) return { error: "Bad number" };
      tokens.push({ kind: "num", text: txt, value: v, cols });
      usedCols.push(...cols);
      continue;
    }
    if (c === "²") {
      // exponent shorthand on previous number → convert to ^2
      tokens.push({ kind: "op", text: "^", op: "^", cols: [i] });
      tokens.push({ kind: "num", text: "2", value: 2, cols: [i] });
      usedCols.push(i);
      i++; continue;
    }
    if (OPS.has(c)) {
      tokens.push({ kind: "op", text: c, op: c as Token["op"], cols: [i] });
      usedCols.push(i); i++; continue;
    }
    if (c === "(") { tokens.push({ kind: "lpar", text: "(", cols: [i] }); usedCols.push(i); i++; continue; }
    if (c === ")") { tokens.push({ kind: "rpar", text: ")", cols: [i] }); usedCols.push(i); i++; continue; }
    return { error: `Unknown symbol: ${c}` };
  }
  return { tokens, usedCols };
};

/* ============== PARSE & EVAL (shunting yard) ============== */
const PREC: Record<string, number> = { "+": 1, "-": 1, "×": 2, "÷": 2, "^": 3 };
const RIGHT: Record<string, boolean> = { "^": true };

export const evalTokens = (tokens: Token[]): { value: number } | { error: string } => {
  if (!tokens.length) return { error: "Empty" };
  // Validate structure quickly (no two ops in a row, no trailing op, balanced parens, no empty parens).
  let parens = 0;
  let prev: TokenKind | "start" = "start";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "lpar") {
      if (prev === "num" || prev === "rpar") return { error: "Missing operator" };
      parens++;
    } else if (t.kind === "rpar") {
      if (prev === "op" || prev === "lpar" || prev === "start") return { error: "Bad )" };
      parens--;
      if (parens < 0) return { error: "Unbalanced" };
    } else if (t.kind === "op") {
      if (t.op === "-" && (prev === "start" || prev === "lpar" || prev === "op")) {
        // unary minus allowed
      } else if (prev === "op" || prev === "lpar" || prev === "start") {
        return { error: "Bad operator" };
      }
    } else if (t.kind === "num") {
      if (prev === "num" || prev === "rpar") return { error: "Missing operator" };
    }
    prev = t.kind;
  }
  if (parens !== 0) return { error: "Unbalanced" };
  if (prev === "op" || prev === "start") return { error: "Incomplete" };

  // Shunting yard
  const out: ({ kind: "num"; v: number } | { kind: "op"; op: string; unary?: boolean })[] = [];
  const stack: ({ kind: "op"; op: string; unary?: boolean } | { kind: "lpar" })[] = [];
  let prevK: TokenKind | "start" = "start";
  for (const t of tokens) {
    if (t.kind === "num") {
      out.push({ kind: "num", v: t.value! });
    } else if (t.kind === "op") {
      const isUnary = t.op === "-" && (prevK === "start" || prevK === "lpar" || prevK === "op");
      if (isUnary) {
        stack.push({ kind: "op", op: "u-", unary: true });
      } else {
        const o1 = t.op!;
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.kind !== "op") break;
          const o2 = top.op;
          if (o2 === "u-") { out.push(stack.pop() as any); continue; }
          const p1 = PREC[o1], p2 = PREC[o2];
          if (p2 > p1 || (p2 === p1 && !RIGHT[o1])) { out.push(stack.pop() as any); }
          else break;
        }
        stack.push({ kind: "op", op: o1 });
      }
    } else if (t.kind === "lpar") {
      stack.push({ kind: "lpar" });
    } else if (t.kind === "rpar") {
      while (stack.length && stack[stack.length - 1].kind !== "lpar") out.push(stack.pop() as any);
      if (!stack.length) return { error: "Unbalanced" };
      stack.pop();
    }
    prevK = t.kind;
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.kind === "lpar") return { error: "Unbalanced" };
    out.push(top as any);
  }

  const ev: number[] = [];
  for (const n of out) {
    if (n.kind === "num") ev.push(n.v);
    else if (n.unary) {
      if (!ev.length) return { error: "Bad expr" };
      ev.push(-ev.pop()!);
    } else {
      if (ev.length < 2) return { error: "Bad expr" };
      const b = ev.pop()!, a = ev.pop()!;
      let r: number;
      switch (n.op) {
        case "+": r = a + b; break;
        case "-": r = a - b; break;
        case "×": r = a * b; break;
        case "÷":
          if (b === 0) return { error: "Divide by zero" };
          r = a / b; break;
        case "^": r = Math.pow(a, b); break;
        default: return { error: "Bad op" };
      }
      ev.push(r);
    }
  }
  if (ev.length !== 1) return { error: "Bad expr" };
  return { value: ev[0] };
};

/* ============== NEXT REQUIRED OP (for glow) ============== */
export const nextRequiredOps = (tokens: Token[]): { letters: Set<"B" | "I" | "D" | "M" | "A" | "S">; opIndices: Set<number> } => {
  const letters = new Set<"B" | "I" | "D" | "M" | "A" | "S">();
  const opIndices = new Set<number>();
  // Find any parens → B
  let depth = 0;
  let firstInnerLpar = -1;
  let firstInnerRpar = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "lpar") {
      if (depth === 0) firstInnerLpar = i;
      depth++;
    } else if (tokens[i].kind === "rpar") {
      depth--;
      if (depth === 0 && firstInnerRpar < 0) { firstInnerRpar = i; break; }
    }
  }
  if (firstInnerLpar >= 0) {
    letters.add("B");
    // Recurse on innermost contents
    const inner = tokens.slice(firstInnerLpar + 1, firstInnerRpar);
    const sub = nextRequiredOps(inner);
    sub.opIndices.forEach((idx) => opIndices.add(idx + firstInnerLpar + 1));
    sub.letters.forEach((l) => letters.add(l));
    return { letters, opIndices };
  }
  // No parens: scan ops at top level. Indices/Exponent first
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "op" && tokens[i].op === "^") { letters.add("I"); opIndices.add(i); }
  }
  if (letters.size > 0) return { letters, opIndices };
  // ÷ × together (left to right)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "op" && (tokens[i].op === "×" || tokens[i].op === "÷")) {
      letters.add(tokens[i].op === "÷" ? "D" : "M");
      opIndices.add(i);
    }
  }
  if (letters.size > 0) return { letters, opIndices };
  // + −
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "op" && (tokens[i].op === "+" || tokens[i].op === "-")) {
      letters.add(tokens[i].op === "+" ? "A" : "S");
      opIndices.add(i);
    }
  }
  return { letters, opIndices };
};

/* ============== STEP CLASSIFY ============== */
export type StepKind = "bidmas" | "rearrange" | "final" | "invalid";

export const classifyStep = (prevTokens: Token[], nextTokens: Token[]): StepKind => {
  const pe = evalTokens(prevTokens);
  const ne = evalTokens(nextTokens);
  if ("error" in pe || "error" in ne) return "invalid";
  if (Math.abs(pe.value - ne.value) > 1e-9) return "invalid";
  // Final?
  if (nextTokens.length === 1 && nextTokens[0].kind === "num") return "final";
  // BIDMAS step: fewer ops, and the removed op was the next-required.
  const prevOps = prevTokens.filter((t) => t.kind === "op").length;
  const nextOps = nextTokens.filter((t) => t.kind === "op").length;
  if (nextOps < prevOps) return "bidmas";
  if (nextOps === prevOps) return "rearrange";
  return "rearrange";
};

/* ============== PROBLEM GENERATION ============== */
const ri = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

export interface BidmasProblem {
  display: string;       // e.g. "3 + 5 × 4"
  cells: Sym[];          // characters per tile, single-char each
  value: number;
}

const cellsFromString = (s: string): Sym[] => {
  // Split into per-tile chars; multi-digit numbers become consecutive digit tiles.
  const out: Sym[] = [];
  for (const ch of s) {
    if (ch === " ") continue;
    out.push(ch);
  }
  return out;
};

export const generateBidmasProblem = (diff: BidmasDifficulty): BidmasProblem => {
  // Templates that yield integer answers and distinct BIDMAS lessons.
  for (let attempt = 0; attempt < 200; attempt++) {
    let s = "";
    if (diff === "easy") {
      const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9);
      const tmpl = ri(0, 1);
      s = tmpl === 0 ? `${a} + ${b} × ${c}` : `${a} × ${b} + ${c}`;
    } else if (diff === "medium") {
      const t = ri(0, 2);
      if (t === 0) {
        // a + b ÷ c with b%c=0
        const c = ri(2, 6); const b = c * ri(2, 6); const a = ri(2, 12);
        s = `${a} + ${b} ÷ ${c}`;
      } else if (t === 1) {
        const a = ri(2, 8), b = ri(2, 8), c = ri(2, 8);
        s = `( ${a} + ${b} ) × ${c}`;
      } else {
        const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9);
        s = `${a} × ${b} - ${c}`;
      }
    } else if (diff === "hard") {
      const t = ri(0, 2);
      if (t === 0) {
        const c = ri(2, 6); const b = c * ri(2, 5); const a = ri(2, 9), d = ri(2, 9);
        s = `${a} + ${b} ÷ ${c} × ${d}`;
      } else if (t === 1) {
        const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9), d = ri(2, 9);
        s = `( ${a} + ${b} ) × ${c} - ${d}`;
      } else {
        const a = ri(2, 9), b = ri(2, 9), c = ri(2, 6), d = c * ri(2, 5);
        s = `${a} × ${b} + ${d} ÷ ${c}`;
      }
    } else {
      // expert: indices + brackets
      const t = ri(0, 2);
      if (t === 0) {
        const a = ri(2, 6), b = ri(2, 9), c = ri(2, 9);
        s = `${a}² + ${b} × ${c}`;
      } else if (t === 1) {
        const a = ri(2, 5), b = ri(2, 5), c = ri(2, 9);
        s = `( ${a} + ${b} )² - ${c}`;
      } else {
        const a = ri(2, 9), b = ri(2, 9), c = ri(2, 5), d = ri(2, 9);
        s = `${a} + ${b} × ${c}² - ${d}`;
      }
    }
    const cells = cellsFromString(s);
    const tk = tokenizeRow(cells);
    if ("error" in tk) continue;
    const ev = evalTokens(tk.tokens);
    if ("error" in ev) continue;
    if (!Number.isInteger(ev.value)) continue;
    if (ev.value < 0 || ev.value > 999) continue;
    return { display: s, cells, value: ev.value };
  }
  // fallback
  return { display: "3 + 5 × 4", cells: cellsFromString("3 + 5 × 4"), value: 23 };
};
