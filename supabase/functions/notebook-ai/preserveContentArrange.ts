// Deterministic Preserve arrangement.
//
// A long paste that already has Question / Solution markers and tier headings
// (Beginner Practice, Intermediate Practice, Expert Practice) was being sent to
// the model, which replaced all 36 items with an introduction. The verifier
// then refused that shell, so the teacher still never received the note.
// When the markers are already clear, arrange them here and do not call the model.
// Pure TS (no Deno imports) so vitest can import it. Generate does not use this.

import { isPracticeTierLine } from "./preserveContentVerifier.ts";

const QUESTION_START =
  /^(example|exercise|classwork|class work|homework|home work|assessment|question|problem|q)\s*(?:no\.?\s*)?(\d{1,3})\b\s*[.):\-–—]?\s*(.*)$/i;

const SOLUTION_BARE = /^(?:worked\s+)?solutions?(?:\s+(\d{1,3}))?\s*$/i;
const SOLUTION_COLON = /^(?:worked\s+)?solutions?(?:\s+(\d{1,3}))?\s*:\s*(.*)$/i;
const ANSWER_BARE = /^(?:answers?|workings?)(?:\s+(\d{1,3}))?\s*$/i;
const ANSWER_COLON = /^(?:answers?|workings?)(?:\s+(\d{1,3}))?\s*:\s*(.*)$/i;

function canonicalActivity(word: string): string {
  const w = word.toLowerCase().replace(/\s+/g, "");
  if (w === "example") return "Example";
  if (w === "classwork") return "Classwork";
  if (w === "homework") return "Homework";
  if (w === "assessment") return "Assessment";
  if (w === "exercise") return "Exercise";
  return "Exercise";
}

function matchQuestion(line: string): { activity: string; n: number; rest: string } | null {
  const m = line.trim().match(QUESTION_START);
  if (!m) return null;
  const n = Number(m[2]);
  if (!Number.isInteger(n) || n < 1) return null;
  return { activity: canonicalActivity(m[1]), n, rest: (m[3] ?? "").trim() };
}

function matchSolution(line: string): { n: number | null; rest: string } | null {
  const t = line.trim();
  let m = t.match(SOLUTION_BARE);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: "" };
  m = t.match(SOLUTION_COLON);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: (m[2] ?? "").trim() };
  m = t.match(ANSWER_BARE);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: "" };
  m = t.match(ANSWER_COLON);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: (m[2] ?? "").trim() };
  return null;
}

/** Copy-paste damage only: flattened delimiters, boxed answers, operator macros.
 *  Sentences and values stay as the teacher wrote them. */
export function repairPreserveNotation(text: string): string {
  let s = text;
  s = s.replace(/\{,\}/g, ",");
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => inner);
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => inner);
  s = s.replace(/\\boxed\s*\{([^{}]*)\}/g, "$1");
  // A digit is a word character, so \b does not see \times4 or \ne81.
  // Stop only when another letter continues the command name.
  const op = (name: string, glyph: string) => {
    s = s.replace(new RegExp(`\\\\${name}(?![A-Za-z])`, "g"), glyph);
  };
  op("qquad", " ");
  op("quad", " ");
  op("times", "×");
  op("cdot", "·");
  op("neq", "≠");
  op("ne", "≠");
  op("leq", "≤");
  op("le", "≤");
  op("geq", "≥");
  op("ge", "≥");
  op("pm", "±");
  op("div", "÷");
  s = s.replace(/\\[,;:!]/g, " ");
  s = s.replace(/\\(?=\s)/g, "");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/^[ \t]+|[ \t]+$/gm, "");
  return s;
}

type QuestionBlock = { activity: string; n: number; lines: string[] };
type SolutionBlock = { n: number; lines: string[] };
type Block =
  | { kind: "prose"; lines: string[] }
  | { kind: "tier"; line: string }
  | { kind: "pair"; q: QuestionBlock; s: SolutionBlock };

function tidy(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

/** A closing remark after the last solution is the teacher's sentence, not more working. */
function peelClosing(lines: string[]): { body: string[]; closing: string[] } {
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end -= 1;
  if (end === 0) return { body: lines, closing: [] };
  let start = end;
  while (start > 0 && lines[start - 1].trim()) start -= 1;
  let before = start;
  while (before > 0 && !lines[before - 1].trim()) before -= 1;
  if (before === 0) return { body: lines, closing: [] };
  const paragraph = lines.slice(start, end).map((l) => l.trim()).filter(Boolean).join(" ");
  const words = paragraph.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 12) return { body: lines, closing: [] };
  if (/[=^\\×÷≤≥≠√]/.test(paragraph)) return { body: lines, closing: [] };
  return { body: lines.slice(0, start), closing: lines.slice(start) };
}

function render(blocks: Block[]): string {
  const out: string[] = [];
  const push = (lines: string[]) => {
    const body = tidy(lines);
    if (!body.length) return;
    if (out.length) out.push("");
    out.push(...body);
  };
  for (const block of blocks) {
    if (block.kind === "prose") push(block.lines);
    else if (block.kind === "tier") push([block.line]);
    else {
      push([`${block.q.activity} ${block.q.n}`, ...block.q.lines]);
      push([`Solution ${block.s.n}`, ...block.s.lines]);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Arrange a paste that already labels every item as Question N / Solution
 * (optionally under tier headings) into lesson-note sessions.
 * Returns null when the markers are not clear enough to pair without guessing.
 * Null keeps the model path for ordinary pastes.
 */
export function arrangePreservePaste(source: string): string | null {
  const text = String(source ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!text.trim()) return null;
  const lines = text.split("\n");

  const blocks: Block[] = [];
  let prose: string[] = [];
  let question: QuestionBlock | null = null;
  let solution: SolutionBlock | null = null;
  let mode: "prose" | "q" | "s" = "prose";
  let questions = 0;
  let solutions = 0;

  const flushProse = () => {
    if (prose.some((l) => l.trim())) blocks.push({ kind: "prose", lines: prose });
    prose = [];
  };
  const flushPair = () => {
    if (!question || !solution) return;
    blocks.push({ kind: "pair", q: question, s: solution });
    question = null;
    solution = null;
    mode = "prose";
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    const kept = raw.replace(/[ \t]+$/g, "");
    if (trimmed && isPracticeTierLine(trimmed)) {
      if (mode === "q") return null;
      if (mode === "s") flushPair();
      else flushProse();
      const heading = trimmed.replace(/^#{1,6}\s*/, "").replace(/[*_`]/g, "").trim();
      blocks.push({ kind: "tier", line: heading });
      mode = "prose";
      continue;
    }
    const started = trimmed ? matchQuestion(trimmed) : null;
    if (started) {
      if (mode === "q") return null;
      if (mode === "s") flushPair();
      else flushProse();
      question = {
        activity: started.activity,
        n: started.n,
        lines: started.rest ? [started.rest] : [],
      };
      solution = null;
      mode = "q";
      questions += 1;
      continue;
    }
    const solved = trimmed ? matchSolution(trimmed) : null;
    if (solved) {
      if (mode !== "q" || !question) return null;
      solution = { n: solved.n ?? question.n, lines: solved.rest ? [solved.rest] : [] };
      mode = "s";
      solutions += 1;
      continue;
    }
    if (mode === "q" && question) question.lines.push(kept);
    else if (mode === "s" && solution) solution.lines.push(kept);
    else prose.push(kept);
  }

  if (mode === "q") return null;
  if (mode === "s") flushPair();
  else flushProse();

  if (questions < 3 || solutions < 3 || questions !== solutions) return null;
  if (!blocks.some((b) => b.kind === "pair")) return null;

  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block.kind !== "pair") continue;
    const peeled = peelClosing(block.s.lines);
    if (peeled.closing.length) {
      block.s = { ...block.s, lines: peeled.body };
      blocks.push({ kind: "prose", lines: peeled.closing });
    }
    break;
  }

  const arranged = repairPreserveNotation(render(blocks)).trim();
  if (!arranged) return null;
  return arranged;
}
