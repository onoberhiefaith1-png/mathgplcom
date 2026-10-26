// Pure helpers behind ChatGPT's precise highlighting, own Floating Numbers and
// lesson validation. Highlights use the same shape the Floating Prep page reads
// ({uid, groupId, tokens:[{line,tok}], payload}) and token indices come from the
// editor's own tokenizer, so the page renders them identically.
import { tokenizeMath, tokenizerFor } from "@/lib/notebook/mathTokens";

export type Selection = { solutionLine: number; start?: number; end?: number };
export type Highlight = {
  uid: string;
  groupId: number;
  tokens: { line: number; tok: number }[];
  payload: string;
  precedingNotebook: string;
  notebookOnly?: boolean;
  /** Set by the Floating Preparation page when `tokens` index the v2 tokenizer. */
  tokVer?: 2;
};

/** Character span of each editor token on one line. */
export function tokenSpans(text: string): { tok: number; start: number; end: number; text: string }[] {
  const out: { tok: number; start: number; end: number; text: string }[] = [];
  let cursor = 0;
  tokenizeMath(text).forEach((t, tok) => {
    const at = text.indexOf(t, cursor);
    const start = at < 0 ? cursor : at;
    out.push({ tok, start, end: start + t.length, text: t });
    cursor = start + t.length;
  });
  return out;
}

export class PrepError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Turn ordered selections into highlights. Throws PrepError on bad input. */
export function buildHighlights(
  solution: string[],
  selections: Selection[],
  mintUid: () => string,
): Highlight[] {
  if (selections.length === 0) throw new PrepError("NO_SELECTIONS", "Give at least one selection.");
  return selections.map((s, i) => {
    const text = solution[s.solutionLine - 1];
    if (text === undefined) {
      throw new PrepError("LINE_NOT_FOUND", `Selection ${i + 1}: solution line ${s.solutionLine} does not exist (solution has ${solution.length} lines).`);
    }
    const start = s.start ?? 0;
    const end = s.end ?? text.length;
    if (start < 0 || end > text.length || start >= end) {
      throw new PrepError("BAD_RANGE", `Selection ${i + 1}: range ${start}-${end} is outside line ${s.solutionLine} (length ${text.length}).`);
    }
    const spans = tokenSpans(text);
    const inside = spans.filter((t) => t.start < end && t.end > start);
    const cut = inside.find((t) => t.start < start || t.end > end);
    if (cut) {
      throw new PrepError("CUTS_TOKEN", `Selection ${i + 1}: range ${start}-${end} cuts through "${cut.text}". Start and end on a space between pieces.`);
    }
    if (inside.length === 0) throw new PrepError("EMPTY_SELECTION", `Selection ${i + 1} contains no text.`);
    return {
      uid: mintUid(),
      groupId: i + 1,
      tokens: inside.map((t) => ({ line: s.solutionLine - 1, tok: t.tok })),
      payload: text.slice(inside[0]!.start, inside[inside.length - 1]!.end),
      precedingNotebook: "",
    };
  });
}

/** Parts of the solution not covered by any highlight (kept as Notes). */
export function unhighlightedNotes(solution: string[], highlights: Highlight[]): { solutionLine: number; text: string }[] {
  const used = new Map<number, Set<number>>();
  for (const h of highlights) for (const t of h.tokens ?? []) {
    (used.get(t.line) ?? used.set(t.line, new Set()).get(t.line)!).add(t.tok);
  }
  const notes: { solutionLine: number; text: string }[] = [];
  // Indices belong to the tokenizer the highlights were saved against: v2 only
  // when every real highlight says so (anything else is the original tokenizer).
  const real = highlights.filter((h) => !h.notebookOnly && (h.tokens?.length ?? 0) > 0);
  const tokenize = real.length > 0 && real.every((h) => h.tokVer === 2) ? tokenizerFor(2) : tokenizeMath;
  solution.forEach((line, i) => {
    const taken = used.get(i);
    const rest = tokenize(line).filter((_t, k) => !taken?.has(k)).join(" ").trim();
    if (rest) notes.push({ solutionLine: i + 1, text: rest });
  });
  return notes;
}

const squash = (s: string) => s.replace(/\s+/g, "");

/** Joining the tokens in order must give back exactly the highlighted text. */
export function reconstructs(payload: string, tokens: string[]): boolean {
  return tokens.length > 0 && tokens.every((t) => t.trim().length > 0) && squash(tokens.join("")) === squash(payload);
}

/** Structural formatting faults in one token (unbalanced braces/brackets). */
export function formattingFault(token: string): string | null {
  let curly = 0, round = 0;
  for (const ch of token) {
    if (ch === "{") curly++; else if (ch === "}") curly--;
    else if (ch === "(") round++; else if (ch === ")") round--;
    if (curly < 0) return "closing brace without opening";
  }
  if (curly !== 0) return "unbalanced braces (a fraction, root or power is cut)";
  if (/\\(frac|sqrt)\s*$/.test(token)) return "fraction/root command with no content";
  if (/\^\s*$/.test(token)) return "power with no exponent";
  return round === 0 ? null : null;
}

export type LineReport = {
  line: string;
  uid: string;
  payload: string;
  tokens: string[] | null;
  reconstructs: boolean;
  issues: string[];
};

export function validateQuestion(input: {
  solution: string[];
  highlights: Highlight[];
  floatingLines: { sourceUid?: string; equation?: string; fillers?: string[] }[];
}): { lines: LineReport[]; issues: string[] } {
  const issues: string[] = [];
  const live = input.highlights.filter((h) => !h.notebookOnly);
  if (input.solution.length === 0) issues.push("no saved solution");
  if (live.length === 0) issues.push("no highlighted lines");
  const seen = new Set<string>();
  for (const h of live) {
    const key = squash(h.payload);
    if (seen.has(key)) issues.push(`duplicated highlight "${h.payload}"`);
    seen.add(key);
  }
  const used = new Set<number>();
  const lines: LineReport[] = live.map((h, i) => {
    const label = `L${i + 1}`;
    let idx = input.floatingLines.findIndex((l) => l.sourceUid === h.uid);
    if (idx < 0 && input.floatingLines[i] && !input.floatingLines[i]!.sourceUid) idx = i;
    const fl = idx >= 0 ? input.floatingLines[idx] : undefined;
    if (idx >= 0) used.add(idx);
    const tokens = fl?.fillers ?? null;
    const lineIssues: string[] = [];
    if (!tokens) lineIssues.push("no Floating Numbers saved for this line");
    const ok = tokens ? reconstructs(h.payload, tokens) : false;
    if (tokens && !ok) lineIssues.push("tokens do not reconstruct the highlighted text");
    for (const t of tokens ?? []) {
      const f = formattingFault(t);
      if (f) lineIssues.push(`token "${t}": ${f}`);
    }
    return { line: label, uid: h.uid, payload: h.payload, tokens, reconstructs: ok, issues: lineIssues };
  });
  input.floatingLines.forEach((l, i) => {
    if (!used.has(i)) issues.push(`saved Floating line ${i + 1} ("${l.equation ?? ""}") matches no highlight`);
  });
  return { lines, issues };
}
